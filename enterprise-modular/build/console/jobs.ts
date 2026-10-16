import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { buildPaths } from '../audit/record.ts';
import { loadPolicy } from '../policy/manifest.ts';
import { verifyPackage } from '../package.ts';
import { canonical, identifier, sha256 } from '../utils.ts';
import { parseJob, releaseMode, STAGES } from './contracts.ts';
import type { BuildJob, ProfileEntry, ReleaseMode, StartedBuild } from './contracts.ts';
import { ConsoleError, readRegularFile, regularDirectory } from './store.ts';
import type { ProfileStore } from './store.ts';
import { snapshotProject } from './snapshot.ts';

type MutableJob = { -readonly [Key in keyof BuildJob]: BuildJob[Key] };
export type JobRunner = (
  project: string,
  requestFile: string,
  output: (text: string) => void,
  signal: AbortSignal,
) => Promise<number>;

export const runJob: JobRunner = (project, requestFile, output, signal) =>
  new Promise<number>((done, reject) => {
    const grouped = process.platform !== 'win32';
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', resolve(project, 'build/console/runner.ts'), '--request', requestFile],
      { cwd: project, shell: false, detached: grouped, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (value: NodeJS.Signals): void => {
      try {
        if (grouped && child.pid) process.kill(-child.pid, value);
        else child.kill(value);
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error;
      }
    };
    const abort = (): void => {
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 2000);
    };
    const cleanup = (): void => {
      signal.removeEventListener('abort', abort);
      clearTimeout(killTimer);
    };
    signal.addEventListener('abort', abort, { once: true });
    child.stdout.setEncoding('utf8').on('data', output);
    child.stderr.setEncoding('utf8').on('data', output);
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('close', (code) => {
      cleanup();
      done(code ?? 1);
    });
    if (signal.aborted) abort();
  });

export function createJobManager(root: string, store: ProfileStore, runner: JobRunner = runJob) {
  const directory = resolve(root, '.console');
  mkdirSync(resolve(directory, 'runs'), { recursive: true });
  regularDirectory(directory);
  const lock = resolve(directory, 'operation.lock');
  const jobs = new Map<string, MutableJob>();
  let activeId: string | null = null;
  let active: Promise<void> | undefined;
  let closed = false;
  const abort = new AbortController();

  const runDirectory = (id: string): string => resolve(directory, 'runs', identifier(id, 'jobId'));
  const projectDirectory = (id: string): string => resolve(runDirectory(id), 'project');
  function persist(job: BuildJob): void {
    const run = runDirectory(job.id);
    regularDirectory(run);
    const temporary = resolve(run, `.metadata-${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, `${JSON.stringify(job, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      renameSync(temporary, resolve(run, 'job.json'));
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  // Finished tasks retain fixed identities across console restarts. Incomplete tasks are never approved.
  for (const name of readdirSync(resolve(directory, 'runs')).sort()) {
    try {
      identifier(name, 'jobId');
      regularDirectory(runDirectory(name));
      const file = resolve(runDirectory(name), 'job.json');
      if (!existsSync(file)) continue;
      const parsed = parseJob(JSON.parse(readRegularFile(file).toString('utf8')));
      if (parsed.id !== name) continue;
      const job: MutableJob = { ...parsed };
      if (job.status === 'running') {
        job.status = 'failed';
        job.error = '上次控制台会话未正常完成此任务，请重新打包。';
        job.finishedAt = new Date().toISOString();
      }
      jobs.set(name, job);
    } catch {
      console.warn(`忽略无效的历史构建记录：${name}`);
    }
  }

  function acquire(id: string): void {
    if (closed) throw new ConsoleError(503, '控制台正在停止');
    if (activeId) throw new ConsoleError(409, '已有打包任务正在运行，请等待完成。', 'busy');
    regularDirectory(directory);
    try {
      writeFileSync(lock, JSON.stringify({ pid: process.pid, id }), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
        throw new ConsoleError(
          409,
          '其他控制台正在保存或打包，请稍后重试。异常停止后请确认旧进程已退出再清理 .console/operation.lock。',
          'busy',
        );
      throw error;
    }
  }
  function release(id: string): void {
    if (!existsSync(lock)) return;
    const value: unknown = JSON.parse(readRegularFile(lock).toString('utf8'));
    if (
      value &&
      typeof value === 'object' &&
      'pid' in value &&
      value.pid === process.pid &&
      'id' in value &&
      value.id === id
    )
      unlinkSync(lock);
  }
  function save(value: unknown, revision: unknown): ProfileEntry {
    const id = `save-${randomUUID()}`;
    acquire(id);
    try {
      return store.save(value, revision);
    } finally {
      release(id);
    }
  }
  function get(id: string): BuildJob | null {
    identifier(id, 'jobId');
    const job = jobs.get(id);
    return job ? structuredClone(job) : null;
  }
  function list(): BuildJob[] {
    return [...jobs.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 30)
      .map((job) => structuredClone(job));
  }
  function verified(id: string) {
    const job = get(id);
    if (!job || job.status !== 'succeeded' || !job.result)
      throw new ConsoleError(409, '此任务尚无通过复验的制品');
    const project = projectDirectory(id);
    try {
      const value = verifyPackage(project, job.profile.enterpriseId, id);
      if (
        value.audit.releaseId !== id ||
        value.audit.enterpriseId !== job.profile.enterpriseId ||
        value.audit.mode !== job.mode ||
        value.audit.configHash !== job.configHash ||
        value.package.packageHash !== job.result.packageHash ||
        value.audit.siteHash !== job.result.siteHash ||
        value.audit.files.length !== job.result.files
      )
        throw new Error('TASK_ARTIFACT_MISMATCH');
      return {
        ...value,
        project,
        site: resolve(buildPaths(project, job.profile.enterpriseId, id).release, 'site'),
        job,
      };
    } catch (error) {
      throw new ConsoleError(
        409,
        `制品复验失败，已拒绝预览和下载：${error instanceof Error ? error.message : '未知错误'}`,
        'artifact_invalid',
      );
    }
  }

  function start(value: unknown, revision: unknown, modeValue: unknown): StartedBuild {
    const mode: ReleaseMode = releaseMode(modeValue);
    const profile = store.validate(value);
    const id = `build-${randomUUID()}`;
    acquire(id);
    let entry: ProfileEntry;
    try {
      entry = store.save(profile, revision);
      mkdirSync(runDirectory(id));
    } catch (error) {
      release(id);
      throw error;
    }
    const job: MutableJob = {
      id,
      profile: entry.profile,
      revision: entry.revision,
      mode,
      configHash: sha256(canonical(entry.profile)),
      status: 'running',
      stage: 'validating',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      log: '',
      error: null,
      result: null,
    };
    jobs.set(id, job);
    activeId = id;
    persist(job);
    let pending = '';
    const output = (text: string): void => {
      const clean = stripVTControlCharacters(text);
      job.log = (job.log + clean).slice(-100000);
      pending = (pending + clean).slice(-110000);
      const lines = pending.split(/\r?\n/u);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const stage = STAGES.find((item) => line === `@@console-stage ${item}`);
        if (stage && STAGES.indexOf(stage) >= STAGES.indexOf(job.stage)) job.stage = stage;
      }
      persist(job);
    };
    active = (async () => {
      try {
        const snapshot = snapshotProject(root, runDirectory(id), entry, mode, id);
        output(`已固定配置快照：${profile.enterpriseId} · ${mode}\n`);
        const code = await runner(snapshot.project, snapshot.requestFile, output, abort.signal);
        if (abort.signal.aborted) throw new Error('控制台已停止，本次打包未完成。');
        if (code !== 0) throw new Error(`打包进程退出（${code}）。请查看日志，修正后重新打包。`);
        job.stage = 'verifying';
        const value = verifyPackage(snapshot.project, profile.enterpriseId, id);
        if (value.audit.mode !== mode || value.audit.configHash !== job.configHash)
          throw new Error('构建结果与本次配置快照不一致');
        const policy = loadPolicy(snapshot.project, profile.enterpriseId);
        job.result = {
          files: value.audit.files.length,
          enabledModules: value.audit.enabledModules,
          excludedModules: policy.catalog
            .filter((module) => !value.audit.enabledModules.includes(module.id))
            .map((module) => module.id),
          siteHash: value.audit.siteHash,
          packageHash: value.package.packageHash,
          packageName: `${profile.enterpriseId}-${mode}-${id}.tar.gz`,
        };
        job.status = 'succeeded';
      } catch (error) {
        job.status = 'failed';
        job.result = null;
        job.error = error instanceof Error ? error.message : '打包失败';
        job.log = `${job.log}\n${job.error}\n`.slice(-100000);
      } finally {
        job.finishedAt = new Date().toISOString();
        try {
          persist(job);
        } finally {
          activeId = null;
          release(id);
        }
      }
    })();
    return { entry, job: structuredClone(job) };
  }
  return {
    save,
    start,
    get,
    list,
    verified,
    activeId: () => activeId,
    async close() {
      closed = true;
      abort.abort();
      await active;
    },
  };
}
export type JobManager = ReturnType<typeof createJobManager>;
