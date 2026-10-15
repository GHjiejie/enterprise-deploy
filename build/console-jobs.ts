import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  cpSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { BuildProfile } from '../shared/build-profile.ts';
import {
  RELEASE_MODES,
  BUILD_STAGES,
  type BuildJob,
  type BuildStage,
  type ProfileEntry,
  type ReleaseMode,
  type StartBuildResponse,
} from '../shared/build-console.ts';
import {
  assertRegularDirectory,
  ConsoleError,
  type ConsoleProfileStore,
  validateConsoleProfile,
} from './console-store.ts';
import { verifyConsoleArtifact } from './console-artifact.ts';
import {
  readConsoleFile,
  verifyConsolePackage,
  writeConsolePackage,
  PACKAGE_LIMITS,
} from './console-package.ts';
import { sha256 } from './release-record.ts';

const MAX_LOG_CHARACTERS = 100_000;

export interface ConsoleBuildRun {
  readonly jobId: string;
  readonly rootDir: string;
  readonly profilesDir: string;
  readonly profile: BuildProfile;
  readonly mode: ReleaseMode;
  readonly signal: AbortSignal;
  readonly onOutput: (text: string) => void;
  readonly onStage?: (stage: BuildStage) => void;
}

export type ConsoleBuildRunner = (run: ConsoleBuildRun) => Promise<number>;

function runCommand(
  command: string,
  args: readonly string[],
  options: {
    cwd: string;
    signal: AbortSignal;
    env?: NodeJS.ProcessEnv;
    onOutput: (text: string) => void;
  },
): Promise<number> {
  if (options.signal.aborted) return Promise.reject(new Error('构建控制台已停止'));
  return new Promise((resolveExit, reject) => {
    const processGroup = process.platform !== 'win32';
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      detached: processGroup,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    function signalChildren(signal: NodeJS.Signals): void {
      try {
        if (processGroup && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error;
      }
    }
    function onAbort(): void {
      signalChildren('SIGTERM');
      killTimer = setTimeout(() => signalChildren('SIGKILL'), 2000);
    }
    function cleanup(): void {
      options.signal.removeEventListener('abort', onAbort);
      if (killTimer) clearTimeout(killTimer);
      if (options.signal.aborted) signalChildren('SIGKILL');
    }
    options.signal.addEventListener('abort', onAbort, { once: true });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', options.onOutput);
    child.stderr.on('data', options.onOutput);
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('close', (code) => {
      cleanup();
      resolveExit(code ?? 1);
    });
  });
}

export const runConsoleBuild: ConsoleBuildRunner = (run) => {
  let pending = '';
  return runCommand('npm', ['run', 'build', '--', '--mode', run.mode], {
    cwd: run.rootDir,
    signal: run.signal,
    env: {
      ...process.env,
      APP_PROFILE: run.profile.id,
      APP_PROFILES_DIR: run.profilesDir,
      APP_BUILD_ID: run.jobId,
    },
    onOutput: (text) => {
      run.onOutput(text);
      pending += text;
      const lines = pending.split(/\r?\n/u);
      pending = (lines.pop() ?? '').slice(-1024);
      for (const line of lines) {
        const match = /^\[build-stage\] (validating|compiling|pruning)$/u.exec(line);
        const stage = match?.[1];
        if (stage && (BUILD_STAGES as readonly string[]).includes(stage))
          run.onStage?.(stage as BuildStage);
      }
    },
  });
};

type MutableJob = { -readonly [Key in keyof BuildJob]: BuildJob[Key] };

export interface ConsoleJobArtifact {
  readonly siteDirectory: string;
  readonly packagePath: string;
  readonly packageSha256: string;
  readonly reportPath: string;
  readonly reportSha256: string;
}

export interface ConsoleJobManager {
  assertIdle(): void;
  save(profile: unknown, expectedRevision: unknown): ProfileEntry;
  start(profile: unknown, expectedRevision: unknown, mode: unknown): StartBuildResponse;
  active(): BuildJob | null;
  get(id: string): BuildJob | null;
  getArtifact(id: string): ConsoleJobArtifact | null;
  readPackage(id: string): Buffer | null;
  readReport(id: string): Buffer | null;
  dispose(): Promise<void>;
}

export interface ConsoleJobManagerOptions {
  readonly rootDir: string;
  readonly store: ConsoleProfileStore;
  readonly runner?: ConsoleBuildRunner;
}

export function createConsoleJobManager(options: ConsoleJobManagerOptions): ConsoleJobManager {
  const rootDir = resolve(options.rootDir);
  const lockPath = join(rootDir, '.console-build.lock');
  const runner = options.runner ?? runConsoleBuild;
  const jobs = new Map<string, MutableJob>();
  const artifacts = new Map<string, ConsoleJobArtifact>();
  const tasks = new Set<Promise<void>>();
  const abort = new AbortController();
  let activeId: string | null = null;
  let disposed = false;

  function assertIdle(): void {
    if (disposed) throw new ConsoleError(503, '构建控制台已停止');
    if (activeId) throw new ConsoleError(409, '已有构建正在运行，请等待完成', 'build_busy');
    try {
      lstatSync(lockPath);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
    throw new ConsoleError(
      409,
      '项目已被其他构建控制台锁定；请等待其完成。如曾异常退出，请确认无构建进程后清理 .console-build.lock',
      'build_busy',
    );
  }

  function acquireLock(jobId: string): void {
    assertRegularDirectory(rootDir);
    try {
      writeFileSync(lockPath, JSON.stringify({ pid: process.pid, jobId }), {
        flag: 'wx',
        mode: 0o600,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        throw new ConsoleError(409, '其他构建控制台已取得项目锁，请等待完成', 'build_busy');
      }
      throw error;
    }
  }

  function releaseLock(jobId: string): void {
    let descriptor: number | undefined;
    try {
      descriptor = openSync(
        lockPath,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      if (!fstatSync(descriptor).isFile()) return;
      const lock = JSON.parse(readFileSync(descriptor, 'utf8')) as { jobId?: unknown };
      if (lock.jobId === jobId) unlinkSync(lockPath);
    } catch {
      // Never remove a changed, foreign or symlinked lock.
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }

  function copyJob(job: BuildJob): BuildJob {
    return structuredClone(job);
  }

  function active(): BuildJob | null {
    const job = activeId ? jobs.get(activeId) : undefined;
    return job ? copyJob(job) : null;
  }

  function appendLog(job: MutableJob, text: string): void {
    job.log = (job.log + text).slice(-MAX_LOG_CHARACTERS);
  }

  async function execute(job: MutableJob, profilesDir: string): Promise<void> {
    const jobDirectory = join(rootDir, 'dist/.console', job.id);
    try {
      job.status = 'running';
      job.stage = 'building';
      job.startedAt = new Date().toISOString();
      const exit = await runner({
        jobId: job.id,
        rootDir,
        profilesDir,
        profile: job.profile,
        mode: job.mode,
        signal: abort.signal,
        onOutput: (text) => appendLog(job, text),
        onStage: (stage) => {
          job.stage = stage;
        },
      });
      if (exit !== 0) throw new Error(`构建进程退出，状态码 ${exit}`);
      if (abort.signal.aborted) throw new Error('构建控制台已停止');
      const outDir = join(rootDir, 'dist', job.profile.id, job.mode);
      const identity = { profile: job.profile, mode: job.mode, jobId: job.id };
      job.stage = 'verifying';
      const { record, report } = verifyConsoleArtifact(outDir, identity);
      const archiveRoot = join(rootDir, 'dist/.console');
      assertRegularDirectory(join(rootDir, 'dist'));
      mkdirSync(archiveRoot, { recursive: true });
      assertRegularDirectory(archiveRoot);
      mkdirSync(jobDirectory);
      assertRegularDirectory(jobDirectory);
      const siteDirectory = join(jobDirectory, 'site');
      job.stage = 'snapshotting';
      cpSync(outDir, siteDirectory, { recursive: true, errorOnExist: true, force: false });
      verifyConsoleArtifact(siteDirectory, identity);
      const packageName = `${job.profile.id}-${job.mode}-${record.buildId}.tar.gz`;
      const packagePath = join(jobDirectory, packageName);
      job.stage = 'packaging';
      writeConsolePackage(siteDirectory, packagePath, record);
      job.stage = 'package-verifying';
      const packageBytes = verifyConsolePackage(packagePath, (directory) => {
        verifyConsoleArtifact(directory, identity);
      });
      if (abort.signal.aborted) throw new Error('构建控制台已停止');
      artifacts.set(job.id, {
        siteDirectory,
        packagePath,
        packageSha256: sha256(packageBytes),
        reportPath: join(siteDirectory, record.pruning.reportPath),
        reportSha256: record.pruning.reportSha256,
      });
      job.result = {
        outDir: `dist/${job.profile.id}/${job.mode}`,
        buildId: record.buildId,
        artifactDigest: record.artifactDigest,
        previewUrl: `/api/builds/${job.id}/preview`,
        downloadUrl: `/api/builds/${job.id}/package`,
        packageName,
        pruning: {
          status: 'passed',
          checkerVersion: report.checkerVersion,
          enabledModules: report.enabledModules,
          excludedModules: report.excludedModules,
          reportDownloadUrl: `/api/builds/${job.id}/pruning-report`,
        },
      };
      job.status = 'succeeded';
      job.stage = 'complete';
    } catch (error) {
      job.status = 'failed';
      job.stage = 'failed';
      job.error = error instanceof Error ? error.message : '构建失败';
      job.result = null;
      artifacts.delete(job.id);
      appendLog(job, `\n${job.error}\n`);
      // Never make a partially copied or stale output available to this job.
      try {
        assertRegularDirectory(join(rootDir, 'dist/.console'));
        rmSync(jobDirectory, { recursive: true, force: true });
      } catch {
        // Refuse to follow an altered output directory during cleanup.
      }
    } finally {
      job.finishedAt = new Date().toISOString();
      rmSync(profilesDir, { recursive: true, force: true });
      if (activeId === job.id) activeId = null;
      releaseLock(job.id);
    }
  }

  function start(value: unknown, expectedRevision: unknown, mode: unknown): StartBuildResponse {
    assertIdle();
    if (typeof mode !== 'string' || !(RELEASE_MODES as readonly string[]).includes(mode)) {
      throw new ConsoleError(400, '请选择 staging 或 production 环境');
    }
    const profile = validateConsoleProfile(value);
    const jobId = randomUUID();
    acquireLock(jobId);
    let profilesDir: string | undefined;
    try {
      options.store.list();
      const entry = options.store.save(profile, expectedRevision);
      profilesDir = mkdtempSync(join(realpathSync(tmpdir()), 'enterprise-console-profiles-'));
      options.store.snapshot(profilesDir);
      // Pin exactly the submitted profile even if an external editor changes the source.
      writeFileSync(
        join(profilesDir, `${profile.id}.json`),
        `${JSON.stringify(profile, null, 2)}\n`,
      );
      const job: MutableJob = {
        id: jobId,
        profile,
        mode: mode as ReleaseMode,
        status: 'queued',
        stage: 'queued',
        startedAt: null,
        finishedAt: null,
        log: '',
        error: null,
        result: null,
      };
      jobs.set(job.id, job);
      activeId = job.id;
      const pinnedProfilesDir = profilesDir;
      const task = Promise.resolve().then(() => execute(job, pinnedProfilesDir));
      tasks.add(task);
      void task.finally(() => tasks.delete(task));
      return { entry, job: copyJob(job) };
    } catch (error) {
      if (profilesDir) rmSync(profilesDir, { recursive: true, force: true });
      releaseLock(jobId);
      throw error;
    }
  }

  async function dispose(): Promise<void> {
    disposed = true;
    abort.abort();
    await Promise.allSettled(tasks);
  }

  function save(value: unknown, expectedRevision: unknown): ProfileEntry {
    assertIdle();
    const leaseId = randomUUID();
    acquireLock(leaseId);
    try {
      return options.store.save(value, expectedRevision);
    } finally {
      releaseLock(leaseId);
    }
  }

  function verifyStoredArtifact(
    id: string,
  ): { artifact: ConsoleJobArtifact; packageBytes: Buffer } | null {
    const artifact = artifacts.get(id);
    const job = jobs.get(id);
    if (!artifact || !job || !job.result || job.status !== 'succeeded') return null;
    const identity = { profile: job.profile, mode: job.mode, jobId: job.id };
    const { record } = verifyConsoleArtifact(artifact.siteDirectory, identity);
    if (
      record.artifactDigest !== job.result.artifactDigest ||
      record.pruning.reportSha256 !== artifact.reportSha256
    ) {
      throw new Error('固定构建快照已发生变化');
    }
    const packageBytes = verifyConsolePackage(artifact.packagePath, (directory) => {
      const unpacked = verifyConsoleArtifact(directory, identity);
      if (unpacked.record.artifactDigest !== job.result?.artifactDigest)
        throw new Error('压缩包与固定快照不一致');
    });
    if (sha256(packageBytes) !== artifact.packageSha256) throw new Error('下载制品已发生变化');
    return { artifact, packageBytes };
  }

  return {
    assertIdle,
    save,
    start,
    active,
    get: (id) => {
      const job = jobs.get(id);
      return job ? copyJob(job) : null;
    },
    getArtifact: (id) => {
      const artifact = verifyStoredArtifact(id)?.artifact;
      return artifact ? { ...artifact } : null;
    },
    readPackage: (id) => verifyStoredArtifact(id)?.packageBytes ?? null,
    readReport: (id) => {
      const verified = verifyStoredArtifact(id);
      if (!verified) return null;
      const bytes = readConsoleFile(verified.artifact.reportPath, PACKAGE_LIMITS.fileBytes);
      if (sha256(bytes) !== verified.artifact.reportSha256) throw new Error('裁剪报告已发生变化');
      return bytes;
    },
    dispose,
  };
}
