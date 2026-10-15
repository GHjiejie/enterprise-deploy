import { afterEach, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BuildProfile } from '../../shared/build-profile.ts';
import {
  canonicalJson,
  RELEASE_RECORD_FILE,
  sha256,
  validateTarget,
  writeReleaseRecord,
  type BackendCompatibility,
  type ReleaseTarget,
} from '../../build/release-record.ts';
import {
  archiveRelease,
  deployRelease,
  rollbackRelease,
  runReleaseCli,
} from '../../build/release-cli.ts';

const temporaryRoots: string[] = [];
const profile: BuildProfile = {
  schemaVersion: 1,
  id: 'enterprise-a',
  modules: { modelCatalog: true, chat: true, imageStudio: false, videoStudio: false },
  defaultModule: 'modelCatalog',
};
const compatibility: BackendCompatibility = {
  policyVersion: 'policy-v1',
  contractVersion: 'contract-v1',
  requiredCapabilities: ['chat.create'],
};
const target: ReleaseTarget = {
  profileId: 'enterprise-a',
  environment: 'production',
  backendPolicy: {
    schemaVersion: 1,
    profileId: 'enterprise-a',
    environment: 'production',
    policyVersion: 'policy-v1',
    contractVersion: 'contract-v1',
    capabilities: ['chat.create', 'image.generate'],
  },
};

function fixture(buildId = 'release-one', version = 'one') {
  const root = mkdtempSync(join(tmpdir(), 'enterprise-release-'));
  temporaryRoots.push(root);
  const outDir = join(root, 'dist');
  mkdirSync(join(outDir, 'assets'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }));
  writeFileSync(
    join(root, 'package-lock.json'),
    JSON.stringify({
      packages: {
        'node_modules/vite': { version: '8.0.0' },
        'node_modules/typescript': { version: '5.9.3' },
      },
    }),
  );
  writeFileSync(join(root, '.env.local'), 'SERVER_SECRET=never-serialize-this\n');
  const assetName = `index-${sha256(version).slice(0, 12)}.js`;
  writeFileSync(join(outDir, 'assets', assetName), `console.log(${JSON.stringify(version)})`);
  writeFileSync(
    join(outDir, 'index.html'),
    `<script type="module" src="/assets/${assetName}"></script>`,
  );
  const record = writeReleaseRecord({
    rootDir: root,
    outDir,
    profile,
    mode: 'production',
    buildId,
    gitCommit: 'a'.repeat(40),
    backendCompatibility: compatibility,
  });
  return { root, outDir, record, assetName, destination: join(root, 'deployment') };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('release records and target verification', () => {
  it('records a complete deterministic inventory and only explicit public metadata', () => {
    const { outDir, record } = fixture();
    expect(validateTarget(outDir, target)).toEqual(record);
    expect(record.enabledModules).toEqual(['modelCatalog', 'chat']);
    expect(record.artifacts.map((file) => file.path)).toEqual(
      [...record.artifacts.map((file) => file.path)].sort(),
    );
    expect(record.artifacts.map((file) => file.path)).not.toContain(RELEASE_RECORD_FILE);
    expect(record.profileDigest).toBe(sha256(canonicalJson(profile)));
    expect(record.lockfile.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(record)).not.toContain('never-serialize-this');
    // A disabled frontend module can coexist with a backend API capability.
    expect(record.profile.modules.imageStudio).toBe(false);
    expect(target.backendPolicy.capabilities).toContain('image.generate');
  });

  it('rejects cross-enterprise and cross-environment artifacts', () => {
    const { outDir } = fixture();
    expect(() => validateTarget(outDir, { ...target, profileId: 'enterprise-b' })).toThrow(
      /profile\/environment/u,
    );
    expect(() => validateTarget(outDir, { ...target, environment: 'staging' })).toThrow(
      /profile\/environment/u,
    );
  });

  it('fingerprints untracked public sources without reading local secret files', () => {
    const { root, outDir, record } = fixture();
    expect(record.sourceState.dirty).toBe(true);
    writeFileSync(join(root, '.env.local'), 'SERVER_SECRET=different-secret\n');
    const unchanged = writeReleaseRecord({
      rootDir: root,
      outDir,
      profile,
      mode: 'production',
      buildId: 'source-unchanged',
      gitCommit: 'a'.repeat(40),
      backendCompatibility: compatibility,
    });
    expect(unchanged.sourceState.digest).toBe(record.sourceState.digest);
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'untracked.ts'), 'export const value = 1;');
    const changed = writeReleaseRecord({
      rootDir: root,
      outDir,
      profile,
      mode: 'production',
      buildId: 'source-changed',
      gitCommit: 'a'.repeat(40),
      backendCompatibility: compatibility,
    });
    expect(changed.sourceState.digest).not.toBe(record.sourceState.digest);
    expect(JSON.stringify(changed)).not.toContain('different-secret');
  });

  it.each(['changed', 'missing', 'extra', 'extra-directory'] as const)(
    'rejects %s artifact contents',
    (mutation) => {
      const { outDir, assetName } = fixture();
      if (mutation === 'changed') writeFileSync(join(outDir, 'index.html'), 'tampered');
      if (mutation === 'missing') rmSync(join(outDir, 'assets', assetName));
      if (mutation === 'extra') writeFileSync(join(outDir, 'unreviewed.js'), 'extra');
      if (mutation === 'extra-directory') mkdirSync(join(outDir, 'unreviewed'));
      expect(() => validateTarget(outDir, target)).toThrow(/integrity/u);
    },
  );

  it('rejects symbolic links even when linked bytes match the expected checksum', () => {
    const { root, outDir } = fixture();
    const original = readFileSync(join(outDir, 'index.html'));
    writeFileSync(join(root, 'index-copy.html'), original);
    rmSync(join(outDir, 'index.html'));
    symlinkSync(join(root, 'index-copy.html'), join(outDir, 'index.html'));
    expect(() => validateTarget(outDir, target)).toThrow(/Symbolic links/u);
  });

  it('rejects an edited profile, unknown metadata, and unsafe file paths', () => {
    const { outDir, record } = fixture();
    const recordPath = join(outDir, RELEASE_RECORD_FILE);
    writeFileSync(
      recordPath,
      JSON.stringify({
        ...record,
        profile: { ...record.profile, modules: { ...record.profile.modules, imageStudio: true } },
      }),
    );
    expect(() => validateTarget(outDir, target)).toThrow(/profile digest/u);
    writeFileSync(recordPath, JSON.stringify({ ...record, extra: 'unknown' }));
    expect(() => validateTarget(outDir, target)).toThrow(/unknown fields/u);
    writeFileSync(
      recordPath,
      JSON.stringify({
        ...record,
        artifacts: [{ path: '../index.html', bytes: 0, sha256: 'a'.repeat(64) }],
      }),
    );
    expect(() => validateTarget(outDir, target)).toThrow(/Unsafe artifact path/u);
  });

  it('validates source provenance metadata rather than accepting a false or malformed state', () => {
    const { outDir, record } = fixture();
    const recordPath = join(outDir, RELEASE_RECORD_FILE);
    writeFileSync(
      recordPath,
      JSON.stringify({ ...record, sourceState: { ...record.sourceState, dirty: 'false' } }),
    );
    expect(() => validateTarget(outDir, target)).toThrow(/dirty status/u);
    writeFileSync(
      recordPath,
      JSON.stringify({ ...record, sourceState: { ...record.sourceState, digest: 'not-a-hash' } }),
    );
    expect(() => validateTarget(outDir, target)).toThrow(/Source snapshot digest/u);
    writeFileSync(recordPath, JSON.stringify({ ...record, gitCommit: 'partial123' }));
    expect(() => validateTarget(outDir, target)).toThrow(/complete Git commit/u);
  });

  it('rejects incompatible backend contract, policy, capability, and target assertions', () => {
    const { outDir } = fixture();
    for (const patch of [
      { contractVersion: 'contract-v2' },
      { policyVersion: 'policy-v2' },
      { capabilities: [] },
    ]) {
      expect(() =>
        validateTarget(outDir, { ...target, backendPolicy: { ...target.backendPolicy, ...patch } }),
      ).toThrow(/compatibility/u);
    }
    expect(() =>
      validateTarget(outDir, {
        ...target,
        backendPolicy: { ...target.backendPolicy, profileId: 'enterprise-b' },
      }),
    ).toThrow(/policy profile\/environment/u);
  });
});

describe('local archive, deployment, and rollback', () => {
  it('archives verified bytes before deployment and rejects reusing an ID for different bytes', () => {
    const first = fixture();
    const archive = archiveRelease(first.outDir, first.destination, target);
    expect(validateTarget(archive, target)).toEqual(first.record);
    expect(existsSync(join(first.destination, 'current'))).toBe(false);
    const other = fixture('release-one', 'other');
    expect(() => archiveRelease(other.outDir, first.destination, target)).toThrow(
      /immutable release/u,
    );
  });

  it('atomically upgrades and rolls back while retaining assets needed by open older pages', () => {
    const first = fixture('release-one', 'one');
    const second = fixture('release-two', 'two');
    deployRelease(first.outDir, first.destination, target);
    expect(readlinkSync(join(first.destination, 'current'))).toBe('releases/release-one');
    deployRelease(second.outDir, first.destination, target);
    expect(readlinkSync(join(first.destination, 'current'))).toBe('releases/release-two');
    for (const artifact of [first, second]) {
      expect(readFileSync(join(first.destination, 'assets', artifact.assetName), 'utf8')).toBe(
        readFileSync(join(artifact.outDir, 'assets', artifact.assetName), 'utf8'),
      );
    }
    // Current config/source are irrelevant to rollback: archived profile/bytes are authoritative.
    rmSync(first.outDir, { recursive: true });
    writeFileSync(join(first.root, 'package.json'), JSON.stringify({ version: '99.0.0' }));
    rollbackRelease('release-one', first.destination, target);
    expect(readlinkSync(join(first.destination, 'current'))).toBe('releases/release-one');
    expect(
      validateTarget(join(first.destination, 'releases', 'release-one'), target).appVersion,
    ).toBe('1.0.0');
    expect(existsSync(join(first.destination, 'assets', second.assetName))).toBe(true);
  });

  it('refuses tampered archives and incompatible rollback without changing the active release', () => {
    const first = fixture('release-one');
    const second = fixture('release-two', 'two');
    deployRelease(first.outDir, first.destination, target);
    deployRelease(second.outDir, first.destination, target);
    const incompatible = {
      ...target,
      backendPolicy: { ...target.backendPolicy, contractVersion: 'changed-backend' },
    };
    expect(() => rollbackRelease('release-one', first.destination, incompatible)).toThrow(
      /compatibility/u,
    );
    writeFileSync(join(first.destination, 'archives', 'release-one', 'index.html'), 'tampered');
    expect(() => rollbackRelease('release-one', first.destination, target)).toThrow(/integrity/u);
    expect(readlinkSync(join(first.destination, 'current'))).toBe('releases/release-two');
  });

  it('rejects a different enterprise target and never overwrites unrelated directories', () => {
    const first = fixture();
    deployRelease(first.outDir, first.destination, target);
    const mismatched = {
      ...target,
      profileId: 'enterprise-b',
      backendPolicy: { ...target.backendPolicy, profileId: 'enterprise-b' },
    };
    expect(() => rollbackRelease('release-one', first.destination, mismatched)).toThrow(
      /target marker/u,
    );
    const unrelated = join(first.root, 'unrelated');
    mkdirSync(unrelated);
    writeFileSync(join(unrelated, 'keep.txt'), 'keep');
    expect(() => deployRelease(first.outDir, unrelated, target)).toThrow(
      /nonempty deployment target/u,
    );
    expect(readFileSync(join(unrelated, 'keep.txt'), 'utf8')).toBe('keep');
    expect(() => deployRelease(first.outDir, first.outDir, target)).toThrow(
      /inside the source artifact/u,
    );
    expect(() => rollbackRelease('../release-one', first.destination, target)).toThrow(
      /safe identifier/u,
    );
  });

  it('refuses a retained asset collision and keeps the previous release active', () => {
    const first = fixture();
    const second = fixture('release-two', 'two');
    deployRelease(first.outDir, first.destination, target);
    writeFileSync(join(first.destination, 'assets', second.assetName), 'untrusted collision');
    expect(() => deployRelease(second.outDir, first.destination, target)).toThrow(
      /collision or tampering/u,
    );
    expect(readlinkSync(join(first.destination, 'current'))).toBe('releases/release-one');
  });

  it('resolves symlink ancestors before creating any target files inside the source artifact', () => {
    const first = fixture();
    const alias = join(first.root, 'artifact-alias');
    symlinkSync(first.outDir, alias, 'dir');
    const destination = join(alias, 'new-target', 'nested');
    for (const operation of [archiveRelease, deployRelease]) {
      expect(() => operation(first.outDir, destination, target)).toThrow(
        /inside the source artifact/u,
      );
      expect(existsSync(join(first.outDir, 'new-target'))).toBe(false);
      expect(validateTarget(first.outDir, target)).toEqual(first.record);
    }
  });

  it('does not replace a normal current directory or follow managed directory symlinks', () => {
    const first = fixture();
    archiveRelease(first.outDir, first.destination, target);
    mkdirSync(join(first.destination, 'current'));
    expect(() => deployRelease(first.outDir, first.destination, target)).toThrow(
      /unexpected current/u,
    );
    rmSync(join(first.destination, 'current'), { recursive: true });
    rmSync(join(first.destination, 'assets'), { recursive: true });
    symlinkSync(first.root, join(first.destination, 'assets'));
    expect(() => deployRelease(first.outDir, first.destination, target)).toThrow(/symbolic link/u);
  });

  it('rejects incomplete or duplicate CLI arguments', () => {
    expect(() => runReleaseCli(['deploy', '--profile', 'enterprise-a'])).toThrow(
      /Missing required/u,
    );
    expect(() =>
      runReleaseCli(['verify', '--profile', 'enterprise-a', '--profile', 'enterprise-a']),
    ).toThrow(/duplicate/u);
  });
});
