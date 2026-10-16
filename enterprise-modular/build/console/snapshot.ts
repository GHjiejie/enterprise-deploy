import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { loadPolicy } from '../policy/manifest.ts';
import { filesIn, within } from '../utils.ts';
import type { ProfileEntry, ReleaseMode } from './contracts.ts';
import { enterpriseJson, readRegularFile, regularDirectory } from './store.ts';

export interface JobRequest {
  readonly enterpriseId: string;
  readonly releaseId: string;
  readonly mode: ReleaseMode;
  readonly source: { readonly commit: string; readonly dirty: boolean };
}

export function snapshotProject(
  root: string,
  run: string,
  entry: ProfileEntry,
  mode: ReleaseMode,
  id: string,
) {
  const project = resolve(run, 'project');
  mkdirSync(project);
  regularDirectory(project);
  const paths = [
    'src',
    'config',
    'build',
    'build-console',
    'index.html',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
  ];
  const policy = loadPolicy(root, entry.profile.enterpriseId);
  for (const owner of policy.catalog)
    for (const ownedRoot of owner.ownedRoots)
      if (!paths.some((path) => within(resolve(root, path), ownedRoot)))
        paths.push(relative(root, ownedRoot));
  for (const name of [
    '.env',
    '.env.local',
    ...['development', 'staging', 'production'].flatMap((mode) => [
      `.env.${mode}`,
      `.env.${mode}.local`,
    ]),
  ])
    if (existsSync(resolve(root, name))) paths.push(name);
  for (const name of paths) {
    const source = resolve(root, name);
    if (
      ['src', 'config', 'build', 'build-console'].includes(name) ||
      policy.catalog.some((owner) => owner.ownedRoots.includes(source))
    ) {
      regularDirectory(source);
      filesIn(source);
    } else readRegularFile(source); // Only known project inputs are copied; no arbitrary request paths.
    mkdirSync(dirname(resolve(project, name)), { recursive: true });
    cpSync(source, resolve(project, name), { recursive: true, dereference: false });
  }
  // Freeze the exact saved selection even if an external editor subsequently changes the source file.
  writeFileSync(
    resolve(project, 'config/enterprises', `${entry.profile.enterpriseId}.json`),
    enterpriseJson(entry.profile),
  );
  symlinkSync(resolve(root, 'node_modules'), resolve(project, 'node_modules'), 'dir');
  let commit = 'unversioned';
  let dirty = true;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    dirty = !!execFileSync('git', ['status', '--porcelain', '--', '.'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    /* The snapshot still has a complete source tree digest when outside Git. */
  }
  const request: JobRequest = {
    enterpriseId: entry.profile.enterpriseId,
    releaseId: id,
    mode,
    source: { commit, dirty },
  };
  const requestFile = resolve(run, 'request.json');
  writeFileSync(requestFile, JSON.stringify(request), { flag: 'wx', mode: 0o600 });
  return { project, requestFile };
}
