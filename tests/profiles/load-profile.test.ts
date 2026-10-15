import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadBuildProfile,
  parseBuildProfile,
  resolveProfilesDirectory,
} from '../../build/load-profile.ts';
import { validateProfiles } from '../../build/validate-profiles.ts';
import { BUILD_MODES, MODULE_IDS, parseBuildMode } from '../../shared/build-profile.ts';

function validProfile(id = 'enterprise-a') {
  return {
    schemaVersion: 1,
    id,
    modules: {
      modelCatalog: true,
      chat: true,
      imageStudio: false,
      videoStudio: false,
    },
    defaultModule: 'modelCatalog',
  };
}

const temporaryDirectories: string[] = [];

function profilesDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'enterprise-profiles-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('parseBuildProfile', () => {
  it('copies and freezes the validated public configuration', () => {
    const input = validProfile();
    const profile = parseBuildProfile(input, 'enterprise-a');

    expect(profile).toEqual(input);
    expect(profile).not.toBe(input);
    expect(profile.modules).not.toBe(input.modules);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.modules)).toBe(true);
    input.modules.imageStudio = true;
    expect(profile.modules.imageStudio).toBe(false);
  });

  it.each([null, [], 'enterprise-a', true, 1])('rejects non-object input %j', (value) => {
    expect(() => parseBuildProfile(value, 'enterprise-a')).toThrow('JSON 对象');
  });

  it.each(['schemaVersion', 'id', 'modules', 'defaultModule'])(
    'requires the explicit %s field',
    (field) => {
      const input: Record<string, unknown> = validProfile();
      delete input[field];
      expect(() => parseBuildProfile(input, 'enterprise-a')).toThrow('字段不完整');
    },
  );

  it('rejects unknown top-level fields', () => {
    expect(() =>
      parseBuildProfile({ ...validProfile(), apiKey: 'unexpected' }, 'enterprise-a'),
    ).toThrow('未知字段');
  });

  it.each([0, 2, '1', null])('rejects unsupported schema version %j', (schemaVersion) => {
    expect(() => parseBuildProfile({ ...validProfile(), schemaVersion }, 'enterprise-a')).toThrow(
      '配置版本',
    );
  });

  it('requires the file id and requested build profile to match', () => {
    expect(() => parseBuildProfile(validProfile('enterprise-b'), 'enterprise-a')).toThrow(
      '构建目标不一致',
    );
  });

  it('rejects an unsafe profile id even when both ids match', () => {
    expect(() => parseBuildProfile(validProfile('../standard'), '../standard')).toThrow(
      'APP_PROFILE',
    );
  });

  it.each([null, [], true, 'all'])('rejects invalid modules value %j', (modules) => {
    expect(() => parseBuildProfile({ ...validProfile(), modules }, 'enterprise-a')).toThrow(
      'modules 必须是对象',
    );
  });

  it.each(MODULE_IDS)('requires an explicit %s decision', (moduleId) => {
    const input = validProfile();
    const modules: Record<string, unknown> = { ...input.modules };
    delete modules[moduleId];
    expect(() => parseBuildProfile({ ...input, modules }, 'enterprise-a')).toThrow('字段不完整');
  });

  it('rejects an unknown module rather than granting a default', () => {
    const input = validProfile();
    expect(() =>
      parseBuildProfile(
        { ...input, modules: { ...input.modules, newModule: true } },
        'enterprise-a',
      ),
    ).toThrow('未知字段');
  });

  it.each(['true', 'false', 1, 0, null, undefined])(
    'rejects a non-boolean module flag %j',
    (enabled) => {
      const input = validProfile();
      expect(() =>
        parseBuildProfile(
          { ...input, modules: { ...input.modules, imageStudio: enabled } },
          'enterprise-a',
        ),
      ).toThrow('modules.imageStudio 必须是布尔值');
    },
  );

  it.each(['imageStudio', 'videoStudio', 'missing', '', null, 1])(
    'rejects disabled or invalid defaultModule %j',
    (defaultModule) => {
      expect(() => parseBuildProfile({ ...validProfile(), defaultModule }, 'enterprise-a')).toThrow(
        'defaultModule 必须是一个已启用模块',
      );
    },
  );
});

describe('loadBuildProfile', () => {
  it.each([undefined, '', '../standard', '/standard', 'Standard', 'a/b', 'a b', 'a'.repeat(65)])(
    'requires a safe explicit APP_PROFILE %j',
    (profileId) => {
      expect(() => loadBuildProfile(profileId)).toThrow('APP_PROFILE');
    },
  );

  it('does not fall back when the selected file is missing', () => {
    expect(() => loadBuildProfile('unknown', profilesDirectory())).toThrow('unknown');
  });

  it('does not fall back when JSON is malformed', () => {
    const directory = profilesDirectory();
    writeFileSync(join(directory, 'enterprise-a.json'), '{invalid}');
    expect(() => loadBuildProfile('enterprise-a', directory)).toThrow('解析企业配置');
  });

  it('validates the JSON file id after reading', () => {
    const directory = profilesDirectory();
    writeFileSync(
      join(directory, 'enterprise-a.json'),
      JSON.stringify(validProfile('enterprise-b')),
    );
    expect(() => loadBuildProfile('enterprise-a', directory)).toThrow('构建目标不一致');
  });

  it('loads enterprise A with both generation studios disabled', () => {
    const directory = profilesDirectory();
    writeFileSync(join(directory, 'enterprise-a.json'), JSON.stringify(validProfile()));
    expect(loadBuildProfile('enterprise-a', directory).modules).toEqual({
      modelCatalog: true,
      chat: true,
      imageStudio: false,
      videoStudio: false,
    });
  });

  it.each(['standard', 'enterprise-b'])('loads %s with every module enabled', (profileId) => {
    const directory = profilesDirectory();
    const profile = validProfile(profileId);
    profile.modules.imageStudio = true;
    profile.modules.videoStudio = true;
    writeFileSync(join(directory, `${profileId}.json`), JSON.stringify(profile));
    expect(Object.values(loadBuildProfile(profileId, directory).modules)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it('resolves an explicit isolated snapshot directory', () => {
    expect(resolveProfilesDirectory('./isolated-profiles')).toBe(resolve('isolated-profiles'));
    expect(() => resolveProfilesDirectory('')).toThrow('不能为空');
  });
});

describe('validateProfiles', () => {
  it('validates every supported checked-in profile with the module registry', () => {
    const directory = resolveProfilesDirectory();
    const fileIds = readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -5))
      .sort();
    expect(validateProfiles(directory).map(({ id }) => id)).toEqual(fileIds);
  });

  it('includes a newly added enterprise configuration automatically', () => {
    const directory = profilesDirectory();
    writeFileSync(
      join(directory, 'enterprise-c.json'),
      JSON.stringify(validProfile('enterprise-c')),
    );
    expect(validateProfiles(directory).map(({ id }) => id)).toEqual(['enterprise-c']);
  });

  it('fails the complete validation if any discovered JSON is malformed', () => {
    const directory = profilesDirectory();
    writeFileSync(join(directory, 'enterprise-a.json'), JSON.stringify(validProfile()));
    writeFileSync(join(directory, 'enterprise-c.json'), '{broken}');
    expect(() => validateProfiles(directory)).toThrow('enterprise-c');
  });

  it('fails when the configuration directory has no supported profile', () => {
    expect(() => validateProfiles(profilesDirectory())).toThrow('没有可校验的企业配置');
  });
});

describe('parseBuildMode', () => {
  it.each(BUILD_MODES)('accepts the supported %s environment', (mode) => {
    expect(parseBuildMode(mode)).toBe(mode);
  });

  it.each([undefined, null, '', 'test', 'Production', 'enterprise-a'])(
    'rejects an unsupported mode %j',
    (mode) => {
      expect(() => parseBuildMode(mode)).toThrow('不支持的环境模式');
    },
  );
});
