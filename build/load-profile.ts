import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS, type BuildProfile, type ModuleId } from '../shared/build-profile.ts';

export const DEFAULT_PROFILES_DIR = fileURLToPath(new URL('../config/profiles/', import.meta.url));

/** The local build console passes an isolated snapshot to its build subprocess. */
export function resolveProfilesDirectory(directory = process.env.APP_PROFILES_DIR): string {
  if (directory === undefined) return DEFAULT_PROFILES_DIR;
  if (!directory.trim()) throw new Error('APP_PROFILES_DIR 不能为空');
  return resolve(directory);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) {
    throw new Error(`${label} 字段不完整或包含未知字段`);
  }
}

function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && (MODULE_IDS as readonly string[]).includes(value);
}

function validateProfileId(profileId: unknown): asserts profileId is string {
  if (typeof profileId !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(profileId)) {
    throw new Error('必须显式指定合法的 APP_PROFILE，例如 enterprise-a');
  }
}

/** Validate and copy only the public profile fields; no defaults or inheritance. */
export function parseBuildProfile(value: unknown, expectedId: string): BuildProfile {
  validateProfileId(expectedId);
  if (!isRecord(value)) throw new Error('企业配置必须是 JSON 对象');

  checkKeys(value, ['schemaVersion', 'id', 'modules', 'defaultModule'], '企业配置');
  if (value.schemaVersion !== 1) throw new Error('不支持的配置版本');
  if (value.id !== expectedId) throw new Error('配置 id 与构建目标不一致');

  if (!isRecord(value.modules)) throw new Error('modules 必须是对象');
  checkKeys(value.modules, MODULE_IDS, 'modules');

  const entries: Array<[ModuleId, boolean]> = [];
  for (const moduleId of MODULE_IDS) {
    const enabled = value.modules[moduleId];
    if (typeof enabled !== 'boolean') {
      throw new Error(`modules.${moduleId} 必须是布尔值`);
    }
    entries.push([moduleId, enabled]);
  }

  // Every key in MODULE_IDS was validated above and appears exactly once.
  const modules = Object.freeze(Object.fromEntries(entries) as Record<ModuleId, boolean>);

  if (!isModuleId(value.defaultModule) || !modules[value.defaultModule]) {
    throw new Error('defaultModule 必须是一个已启用模块');
  }

  return Object.freeze({
    schemaVersion: 1,
    id: expectedId,
    modules,
    defaultModule: value.defaultModule,
  });
}

/** Node-only loader shared by local development, build scripts, and CI. */
export function loadBuildProfile(
  profileId: string | undefined,
  profilesDir = resolveProfilesDirectory(),
): BuildProfile {
  validateProfileId(profileId);
  const profilePath = join(profilesDir, `${profileId}.json`);
  console.log(`加载企业配置 ${profileId} -> ${profilePath}`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(profilePath, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取或解析企业配置：${profileId}`, { cause: error });
  }

  return parseBuildProfile(raw, profileId);
}
