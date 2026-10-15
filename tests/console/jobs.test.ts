import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BuildProfile } from '../../shared/build-profile.ts';
import type { BuildStage } from '../../shared/build-console.ts';
import {
  createConsoleJobManager,
  runConsoleBuild,
  type ConsoleBuildRun,
  type ConsoleBuildRunner,
  type ConsoleJobManager,
} from '../../build/console-jobs.ts';
import { createConsoleProfileStore } from '../../build/console-store.ts';
import {
  canonicalJson,
  RELEASE_RECORD_FILE,
  scanArtifacts,
  sha256,
} from '../../build/release-record.ts';
import { writeFixturePruningReport } from '../helpers/pruned-artifact.ts';

const roots: string[] = [];
const managers: ConsoleJobManager[] = [];
const releaseRunners: Array<() => void> = [];

function profile(id = 'enterprise-a'): BuildProfile {
  return {
    schemaVersion: 1,
    id,
    modules: { modelCatalog: true, chat: true, imageStudio: false, videoStudio: false },
    defaultModule: 'modelCatalog',
  };
}

function fixture(runner: ConsoleBuildRunner) {
  const rootDir = mkdtempSync(join(realpathSync(tmpdir()), 'enterprise-console-jobs-'));
  roots.push(rootDir);
  const profilesDir = join(rootDir, 'config/profiles');
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(join(profilesDir, 'enterprise-a.json'), JSON.stringify(profile()));
  const store = createConsoleProfileStore(rootDir);
  const jobs = createConsoleJobManager({ rootDir, store, runner });
  managers.push(jobs);
  return { rootDir, store, jobs, profilesDir };
}

function writeArtifact(run: ConsoleBuildRun, overrides: Record<string, unknown> = {}): string {
  const outDir = join(run.rootDir, 'dist', run.profile.id, run.mode);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'assets'), { recursive: true });
  writeFileSync(join(outDir, 'index.html'), '<script src="/assets/app.js"></script>');
  writeFileSync(join(outDir, 'assets/app.js'), JSON.stringify(run.profile));
  const pruning = writeFixturePruningReport(outDir, run.profile, run.mode, run.jobId);
  const files = scanArtifacts(outDir);
  writeFileSync(
    join(outDir, RELEASE_RECORD_FILE),
    JSON.stringify({
      schemaVersion: 2,
      pruning,
      profileId: run.profile.id,
      environment: run.mode,
      appVersion: '0.1.0',
      gitCommit: 'unversioned',
      sourceState: { dirty: true, digest: 'a'.repeat(64) },
      profile: run.profile,
      profileDigest: sha256(canonicalJson(run.profile)),
      enabledModules: Object.entries(run.profile.modules)
        .filter(([, enabled]) => enabled)
        .map(([id]) => id),
      buildId: run.jobId,
      builtAt: new Date().toISOString(),
      toolchain: { node: '22', npm: '10', vite: '8', typescript: '5.9' },
      lockfile: { path: 'package-lock.json', sha256: 'b'.repeat(64) },
      buildCommand: 'npm run build',
      backendCompatibility: {
        policyVersion: 'v1',
        contractVersion: 'v1',
        requiredCapabilities: [],
      },
      ...files,
      artifactDigest: sha256(canonicalJson(files)),
      ...overrides,
    }),
  );
  return outDir;
}

async function finished(jobs: ConsoleJobManager, id: string) {
  await expect.poll(() => jobs.get(id)?.status).toMatch(/^(succeeded|failed)$/u);
  return jobs.get(id)!;
}

afterEach(async () => {
  for (const release of releaseRunners.splice(0)) release();
  await Promise.all(managers.splice(0).map((jobs) => jobs.dispose()));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('console profile storage', () => {
  it('creates arbitrary enterprise ids and uses revisions to reject stale updates', () => {
    const { store } = fixture(async () => 1);
    const created = store.save(profile('enterprise-c'), null);
    expect(created.revision).toMatch(/^[a-f0-9]{64}$/u);
    expect(store.list().map((entry) => entry.profile.id)).toEqual(['enterprise-a', 'enterprise-c']);
    expect(() => store.save(profile('enterprise-c'), null)).toThrow('已被修改或已存在');
    const changed = {
      ...created.profile,
      modules: { ...created.profile.modules, imageStudio: true },
    };
    const saved = store.save(changed, created.revision);
    expect(saved.revision).not.toBe(created.revision);
    expect(() => store.save(created.profile, created.revision)).toThrow('已被修改或已存在');
    expect(store.list().find((entry) => entry.profile.id === 'enterprise-c')?.profile).toEqual(
      changed,
    );
  });

  it('rejects invalid profiles, filename traversal and symlinks without changing targets', () => {
    const { store, rootDir, profilesDir } = fixture(async () => 1);
    expect(() => store.save(profile('../escaped'), null)).toThrow('APP_PROFILE');
    expect(() =>
      store.save({ ...profile(), defaultModule: 'imageStudio' }, store.list()[0]!.revision),
    ).toThrow('已启用模块');
    const outside = join(rootDir, 'outside.json');
    writeFileSync(outside, JSON.stringify(profile('linked')));
    symlinkSync(outside, join(profilesDir, 'linked.json'));
    expect(() => store.list()).toThrow('符号链接');
    expect(() => store.save(profile('linked'), null)).toThrow('符号链接');
    expect(JSON.parse(readFileSync(outside, 'utf8'))).toEqual(profile('linked'));
    expect(existsSync(join(rootDir, 'escaped.json'))).toBe(false);
  });

  it('rejects a symlinked profile directory', () => {
    const { rootDir, profilesDir } = fixture(async () => 1);
    const linked = join(rootDir, 'profiles-link');
    symlinkSync(profilesDir, linked);
    const store = createConsoleProfileStore(rootDir, linked);
    expect(() => store.list()).toThrow('符号链接');
    expect(() => store.save(profile('new'), null)).toThrow('符号链接');
  });
});

describe('console build jobs', () => {
  it('reports only complete recognized build-stage lines from the real child output', async () => {
    const { rootDir, profilesDir } = fixture(async () => 1);
    writeFileSync(
      join(rootDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node stages.cjs' } }),
    );
    writeFileSync(
      join(rootDir, 'stages.cjs'),
      `
      process.stdout.write('[build-stage] vali');
      setTimeout(() => {
        process.stdout.write('dating\\n[build-stage] compiling\\n');
        process.stdout.write('[build-stage] complete\\n[build-stage] pruning\\n');
      }, 20);
    `,
    );
    const stages: BuildStage[] = [];
    const exit = await runConsoleBuild({
      jobId: 'stage-fixture',
      rootDir,
      profilesDir,
      profile: profile(),
      mode: 'production',
      signal: new AbortController().signal,
      onOutput: () => {},
      onStage: (stage) => stages.push(stage),
    });
    expect(exit).toBe(0);
    expect(stages).toEqual(['validating', 'compiling', 'pruning']);
  });

  it('pins submitted config, snapshots output and produces a verified downloadable archive', async () => {
    let captured: ConsoleBuildRun | undefined;
    const { store, jobs, profilesDir } = fixture(async (run) => {
      captured = run;
      expect(JSON.parse(readFileSync(join(run.profilesDir, 'enterprise-c.json'), 'utf8'))).toEqual(
        profile('enterprise-c'),
      );
      // Editing the source profile cannot change the running build snapshot.
      writeFileSync(
        join(profilesDir, 'enterprise-c.json'),
        JSON.stringify({
          ...profile('enterprise-c'),
          modules: { ...profile('enterprise-c').modules, imageStudio: true },
        }),
      );
      expect(JSON.parse(readFileSync(join(run.profilesDir, 'enterprise-c.json'), 'utf8'))).toEqual(
        profile('enterprise-c'),
      );
      run.onOutput('build output\n');
      writeArtifact(run);
      return 0;
    });
    const started = jobs.start(profile('enterprise-c'), null, 'production');
    expect(started.job.status).toBe('queued');
    expect(store.list().map((entry) => entry.profile.id)).toContain('enterprise-c');
    const job = await finished(jobs, started.job.id);
    expect(job.status).toBe('succeeded');
    expect(job.log).toContain('build output');
    expect(job.result?.buildId).toBe(job.id);
    expect(job.result?.previewUrl).toBe(`/api/builds/${job.id}/preview`);
    expect(job.stage).toBe('complete');
    expect(job.result?.pruning).toMatchObject({
      status: 'passed',
      enabledModules: ['modelCatalog', 'chat'],
      excludedModules: ['imageStudio', 'videoStudio'],
      reportDownloadUrl: `/api/builds/${job.id}/pruning-report`,
    });
    expect(job.startedAt).not.toBeNull();
    expect(job.finishedAt).not.toBeNull();
    const artifact = jobs.getArtifact(job.id)!;
    expect(artifact.siteDirectory).toContain(`/.console/${job.id}/site`);
    expect(existsSync(captured!.profilesDir)).toBe(false);
    const archived = execFileSync('tar', ['-xOzf', artifact.packagePath, './release-record.json'], {
      encoding: 'utf8',
    });
    expect(JSON.parse(archived).profile).toEqual(job.profile);
    expect(JSON.parse(jobs.readReport(job.id)!.toString('utf8')).enabledModules).toEqual([
      'modelCatalog',
      'chat',
    ]);
    expect(jobs.readPackage(job.id)).toEqual(readFileSync(artifact.packagePath));
    writeFileSync(join(captured!.rootDir, job.result!.outDir, 'index.html'), 'new build');
    expect(readFileSync(join(artifact.siteDirectory, 'index.html'), 'utf8')).toContain('<script');
  });

  it.each(['snapshot', 'package', 'report'])(
    'refuses %s changes after successful build before access',
    async (kind) => {
      const { jobs, store } = fixture(async (run) => {
        writeArtifact(run);
        return 0;
      });
      const started = jobs.start(profile(), store.list()[0]!.revision, 'production');
      expect((await finished(jobs, started.job.id)).status).toBe('succeeded');
      const artifact = jobs.getArtifact(started.job.id)!;
      const target =
        kind === 'package'
          ? artifact.packagePath
          : kind === 'report'
            ? artifact.reportPath
            : join(artifact.siteDirectory, 'assets/app.js');
      writeFileSync(target, 'tampered');
      expect(() => jobs.getArtifact(started.job.id)).toThrow();
      expect(() => jobs.readPackage(started.job.id)).toThrow();
      expect(() => jobs.readReport(started.job.id)).toThrow();
    },
  );

  it('rejects a legacy V1 success record without presenting pruning success', async () => {
    const { jobs, store } = fixture(async (run) => {
      const outDir = writeArtifact(run);
      const recordPath = join(outDir, RELEASE_RECORD_FILE);
      const { pruning: _pruning, ...record } = JSON.parse(readFileSync(recordPath, 'utf8'));
      writeFileSync(recordPath, JSON.stringify({ ...record, schemaVersion: 1 }));
      return 0;
    });
    const started = jobs.start(profile(), store.list()[0]!.revision, 'production');
    const job = await finished(jobs, started.job.id);
    expect(job.status).toBe('failed');
    expect(job.stage).toBe('failed');
    expect(job.result).toBeNull();
    expect(job.error).toContain('V2');
  });

  it('blocks concurrent builds before saving their profiles and bounds log output', async () => {
    let release: (() => void) | undefined;
    const { store, jobs } = fixture(async (run) => {
      run.onOutput('x'.repeat(150_000));
      await new Promise<void>((resolve) => {
        release = resolve;
        releaseRunners.push(resolve);
      });
      return 1;
    });
    const started = jobs.start(profile('enterprise-c'), null, 'production');
    await expect.poll(() => jobs.active()?.status).toBe('running');
    expect(() => jobs.start(profile('enterprise-d'), null, 'production')).toThrow('已有构建');
    expect(store.list().map((entry) => entry.profile.id)).not.toContain('enterprise-d');
    expect(jobs.get(started.job.id)!.log.length).toBe(100_000);
    release!();
    const job = await finished(jobs, started.job.id);
    expect(job.status).toBe('failed');
    expect(jobs.active()).toBeNull();
    expect(job.result).toBeNull();
    expect(jobs.getArtifact(job.id)).toBeNull();
  });

  it('locks the project across console instances before either build or save can mutate config', async () => {
    let release: (() => void) | undefined;
    const { rootDir, store, jobs } = fixture(
      () =>
        new Promise<number>((resolve) => {
          release = () => resolve(1);
          releaseRunners.push(release);
        }),
    );
    const second = createConsoleJobManager({ rootDir, store, runner: async () => 1 });
    managers.push(second);
    const started = jobs.start(profile(), store.list()[0]!.revision, 'production');
    await expect.poll(() => jobs.active()?.status).toBe('running');
    expect(() => second.start(profile('enterprise-c'), null, 'production')).toThrow('锁定');
    expect(() => second.save(profile('enterprise-c'), null)).toThrow('锁定');
    expect(store.list().map((entry) => entry.profile.id)).toEqual(['enterprise-a']);
    expect(existsSync(join(rootDir, '.console-build.lock'))).toBe(true);
    release!();
    await finished(jobs, started.job.id);
    expect(existsSync(join(rootDir, '.console-build.lock'))).toBe(false);
    expect(second.save(profile('enterprise-c'), null).profile.id).toBe('enterprise-c');
    expect(existsSync(join(rootDir, '.console-build.lock'))).toBe(false);
  });

  it('does not silently remove a leftover or foreign project lock', () => {
    const { rootDir, jobs, store } = fixture(async () => 1);
    const lockPath = join(rootDir, '.console-build.lock');
    const bytes = JSON.stringify({ pid: 123, jobId: 'previous-process' });
    writeFileSync(lockPath, bytes);
    expect(() => jobs.start(profile('enterprise-c'), null, 'production')).toThrow('锁定');
    expect(() => jobs.save(profile('enterprise-c'), null)).toThrow('锁定');
    expect(readFileSync(lockPath, 'utf8')).toBe(bytes);
    expect(store.list().map((entry) => entry.profile.id)).toEqual(['enterprise-a']);
  });

  it('releases its project lock after a rejected save or build revision', () => {
    const { rootDir, jobs } = fixture(async () => 1);
    expect(() => jobs.start(profile(), null, 'production')).toThrow('已被修改或已存在');
    expect(existsSync(join(rootDir, '.console-build.lock'))).toBe(false);
    expect(() => jobs.save(profile(), null)).toThrow('已被修改或已存在');
    expect(existsSync(join(rootDir, '.console-build.lock'))).toBe(false);
  });

  it.skipIf(process.platform === 'win32')(
    'terminates the entire npm process group when stopped',
    async () => {
      const { rootDir, profilesDir } = fixture(async () => 1);
      writeFileSync(
        join(rootDir, 'package.json'),
        JSON.stringify({
          scripts: { build: 'node build-child.cjs' },
        }),
      );
      writeFileSync(
        join(rootDir, 'build-child.cjs'),
        `
      const { spawn } = require('node:child_process');
      spawn(process.execPath, ['-e', "require('node:fs').writeFileSync('grandchild.pid', String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], { stdio: 'inherit' });
      setInterval(() => {}, 1000);
    `,
      );
      const abort = new AbortController();
      const pending = runConsoleBuild({
        jobId: 'test-child-process',
        rootDir,
        profilesDir,
        profile: profile(),
        mode: 'production',
        signal: abort.signal,
        onOutput: () => {},
      });
      await expect.poll(() => existsSync(join(rootDir, 'grandchild.pid'))).toBe(true);
      const childPid = Number(readFileSync(join(rootDir, 'grandchild.pid'), 'utf8'));
      abort.abort();
      await pending;
      await expect
        .poll(() => {
          try {
            process.kill(childPid, 0);
            return true;
          } catch {
            return false;
          }
        })
        .toBe(false);
    },
  );

  it.each(['development', 'test', '../production', null])(
    'rejects unsupported mode %j before saving',
    (mode) => {
      const { jobs, store } = fixture(async () => 0);
      expect(() => jobs.start(profile('enterprise-c'), null, mode)).toThrow('环境');
      expect(store.list().map((entry) => entry.profile.id)).not.toContain('enterprise-c');
    },
  );

  it.each(['stale-build', 'wrong-profile', 'changed-files', 'symlink-artifact'])(
    'rejects %s output without exposing old or partial artifacts',
    async (kind) => {
      const { jobs, store } = fixture(async (run) => {
        const outDir = writeArtifact(run, kind === 'stale-build' ? { buildId: 'older-build' } : {});
        if (kind === 'wrong-profile') {
          writeArtifact({
            ...run,
            profile: { ...run.profile, modules: { ...run.profile.modules, imageStudio: true } },
          });
        }
        if (kind === 'changed-files') writeFileSync(join(outDir, 'index.html'), 'tampered');
        if (kind === 'symlink-artifact') symlinkSync('/etc/hosts', join(outDir, 'linked'));
        return 0;
      });
      const started = jobs.start(profile(), store.list()[0]!.revision, 'staging');
      const job = await finished(jobs, started.job.id);
      expect(job.status).toBe('failed');
      expect(job.error).toBeTruthy();
      expect(job.result).toBeNull();
      expect(jobs.getArtifact(job.id)).toBeNull();
    },
  );

  it('refuses symlinked archive roots without creating or removing outside files', async () => {
    let outside: string;
    const { jobs, store, rootDir } = fixture(async (run) => {
      writeArtifact(run);
      outside = join(run.rootDir, 'outside');
      mkdirSync(outside);
      writeFileSync(join(outside, 'keep.txt'), 'keep');
      symlinkSync(outside, join(run.rootDir, 'dist/.console'));
      return 0;
    });
    const started = jobs.start(profile(), store.list()[0]!.revision, 'production');
    expect((await finished(jobs, started.job.id)).status).toBe('failed');
    expect(readFileSync(join(rootDir, 'outside/keep.txt'), 'utf8')).toBe('keep');
    expect(existsSync(join(rootDir, 'outside', started.job.id))).toBe(false);
  });
});
