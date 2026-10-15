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
  type BuildJob,
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
import {
  canonicalJson,
  parseReleaseRecord,
  RELEASE_RECORD_FILE,
  scanArtifacts,
  type ReleaseRecord,
} from './release-record.ts';

const MAX_LOG_CHARACTERS = 100_000;

export interface ConsoleBuildRun {
  readonly jobId: string;
  readonly rootDir: string;
  readonly profilesDir: string;
  readonly profile: BuildProfile;
  readonly mode: ReleaseMode;
  readonly signal: AbortSignal;
  readonly onOutput: (text: string) => void;
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

export const runConsoleBuild: ConsoleBuildRunner = (run) =>
  runCommand('npm', ['run', 'build', '--', '--mode', run.mode], {
    cwd: run.rootDir,
    signal: run.signal,
    env: {
      ...process.env,
      APP_PROFILE: run.profile.id,
      APP_PROFILES_DIR: run.profilesDir,
      APP_BUILD_ID: run.jobId,
    },
    onOutput: run.onOutput,
  });

type MutableJob = { -readonly [Key in keyof BuildJob]: BuildJob[Key] };

export interface ConsoleJobArtifact {
  readonly siteDirectory: string;
  readonly packagePath: string;
}

export interface ConsoleJobManager {
  assertIdle(): void;
  save(profile: unknown, expectedRevision: unknown): ProfileEntry;
  start(profile: unknown, expectedRevision: unknown, mode: unknown): StartBuildResponse;
  active(): BuildJob | null;
  get(id: string): BuildJob | null;
  getArtifact(id: string): ConsoleJobArtifact | null;
  dispose(): Promise<void>;
}

export interface ConsoleJobManagerOptions {
  readonly rootDir: string;
  readonly store: ConsoleProfileStore;
  readonly runner?: ConsoleBuildRunner;
}

function verifyArtifact(
  directory: string,
  profile: BuildProfile,
  mode: ReleaseMode,
  jobId: string,
): ReleaseRecord {
  assertRegularDirectory(directory);
  const recordPath = join(directory, RELEASE_RECORD_FILE);
  const stat = lstatSync(recordPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('构建发布记录必须是普通文件');
  }
  const record = parseReleaseRecord(JSON.parse(readFileSync(recordPath, 'utf8')));
  if (
    record.buildId !== jobId ||
    record.environment !== mode ||
    canonicalJson(record.profile) !== canonicalJson(profile)
  ) {
    throw new Error('构建产物的企业配置或环境与当前任务不一致');
  }
  if (
    canonicalJson(scanArtifacts(directory)) !==
    canonicalJson({ artifacts: record.artifacts, directories: record.directories })
  ) {
    throw new Error('构建产物完整性校验失败');
  }
  return record;
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
      job.startedAt = new Date().toISOString();
      const exit = await runner({
        jobId: job.id,
        rootDir,
        profilesDir,
        profile: job.profile,
        mode: job.mode,
        signal: abort.signal,
        onOutput: (text) => appendLog(job, text),
      });
      if (exit !== 0) throw new Error(`构建进程退出，状态码 ${exit}`);
      if (abort.signal.aborted) throw new Error('构建控制台已停止');
      const outDir = join(rootDir, 'dist', job.profile.id, job.mode);
      const record = verifyArtifact(outDir, job.profile, job.mode, job.id);
      const archiveRoot = join(rootDir, 'dist/.console');
      assertRegularDirectory(join(rootDir, 'dist'));
      mkdirSync(archiveRoot, { recursive: true });
      assertRegularDirectory(archiveRoot);
      mkdirSync(jobDirectory);
      assertRegularDirectory(jobDirectory);
      const siteDirectory = join(jobDirectory, 'site');
      cpSync(outDir, siteDirectory, { recursive: true, errorOnExist: true, force: false });
      verifyArtifact(siteDirectory, job.profile, job.mode, job.id);
      const packageName = `${job.profile.id}-${job.mode}-${record.buildId}.tar.gz`;
      const packagePath = join(jobDirectory, packageName);
      const tarExit = await runCommand('tar', ['-czf', packagePath, '-C', siteDirectory, '.'], {
        cwd: rootDir,
        signal: abort.signal,
        onOutput: (text) => appendLog(job, text),
      });
      if (tarExit !== 0) throw new Error(`制品打包失败，状态码 ${tarExit}`);
      artifacts.set(job.id, { siteDirectory, packagePath });
      job.result = {
        outDir: `dist/${job.profile.id}/${job.mode}`,
        buildId: record.buildId,
        artifactDigest: record.artifactDigest,
        previewUrl: `/api/builds/${job.id}/preview`,
        downloadUrl: `/api/builds/${job.id}/package`,
        packageName,
      };
      job.status = 'succeeded';
    } catch (error) {
      job.status = 'failed';
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
      const artifact = artifacts.get(id);
      return artifact ? { ...artifact } : null;
    },
    dispose,
  };
}
