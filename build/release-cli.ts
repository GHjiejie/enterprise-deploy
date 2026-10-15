import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  readlinkSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  canonicalJson,
  environment,
  parseBackendPolicy,
  RELEASE_RECORD_FILE,
  safeIdentifier,
  sha256,
  validateTarget,
  type ReleaseRecord,
  type ReleaseTarget,
} from './release-record.ts';

const TARGET_MARKER = '.enterprise-target.json';
const LOCK_DIRECTORY = '.release-lock';

function inside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function regularDirectory(path: string): void {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error(`Managed directory must not be a symbolic link: ${path}`);
}

/** Resolve existing ancestors before creating anything, including missing descendants. */
function realDestination(path: string): string {
  let ancestor = path;
  const missing: string[] = [];
  for (;;) {
    try {
      lstatSync(ancestor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      missing.push(basename(ancestor));
      ancestor = parent;
      continue;
    }
    // A dangling existing symlink must fail here, never count as a missing segment.
    return resolve(realpathSync(ancestor), ...missing.reverse());
  }
}

function safeTargetRoot(path: string, target: ReleaseTarget, artifact?: string): string {
  const requested = resolve(path);
  try {
    if (lstatSync(requested).isSymbolicLink())
      throw new Error('Deployment target root must not be a symbolic link');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const root = realDestination(requested);
  const cwd = realpathSync(process.cwd());
  const forbidden = [resolve(sep), realpathSync(homedir())];
  if (forbidden.includes(root) || inside(root, cwd))
    throw new Error(
      'Deployment target must be a dedicated directory, not the home, repository, or an ancestor',
    );
  if (artifact && inside(realpathSync(resolve(artifact)), root))
    throw new Error('Deployment target cannot be inside the source artifact');
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  regularDirectory(root);
  const marker = join(root, TARGET_MARKER);
  const expected = {
    schemaVersion: 1,
    profileId: target.profileId,
    environment: environment(target.environment),
  };
  if (!existsSync(marker)) {
    if (readdirSync(root).length !== 0)
      throw new Error('Refusing nonempty deployment target without an enterprise target marker');
    writeFileSync(marker, `${JSON.stringify(expected, null, 2)}\n`, { flag: 'wx' });
  }
  const stat = lstatSync(marker);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    canonicalJson(JSON.parse(readFileSync(marker, 'utf8'))) !== canonicalJson(expected)
  )
    throw new Error('Deployment target marker does not match requested profile/environment');
  return root;
}

function managedDirectory(root: string, name: string): string {
  const path = join(root, name);
  if (!existsSync(path)) mkdirSync(path);
  regularDirectory(path);
  return path;
}

function withTargetLock<T>(root: string, action: () => T): T {
  const path = join(root, LOCK_DIRECTORY);
  try {
    mkdirSync(path);
  } catch {
    throw new Error('Deployment target is locked; another release operation may be running');
  }
  try {
    return action();
  } finally {
    rmSync(path, { recursive: true });
  }
}

function sameRelease(first: ReleaseRecord, second: ReleaseRecord): boolean {
  return canonicalJson(first) === canonicalJson(second);
}

function copyVerifiedRelease(
  source: string,
  parent: string,
  record: ReleaseRecord,
  target: ReleaseTarget,
): string {
  const destination = join(parent, record.buildId);
  if (existsSync(destination)) {
    if (!sameRelease(validateTarget(destination, target), record))
      throw new Error(
        'An immutable release already exists with this buildId and different contents',
      );
    return destination;
  }
  const temporary = join(parent, `.tmp-${randomUUID()}`);
  mkdirSync(temporary);
  try {
    for (const path of record.directories) mkdirSync(join(temporary, path), { recursive: true });
    for (const file of record.artifacts)
      copyFileSync(join(source, file.path), join(temporary, file.path), constants.COPYFILE_EXCL);
    copyFileSync(
      join(source, RELEASE_RECORD_FILE),
      join(temporary, RELEASE_RECORD_FILE),
      constants.COPYFILE_EXCL,
    );
    if (!sameRelease(validateTarget(temporary, target), record))
      throw new Error('Artifact changed while being copied');
    renameSync(temporary, destination);
    return destination;
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { recursive: true });
  }
}

function archiveUnlocked(
  source: string,
  root: string,
  target: ReleaseTarget,
): { path: string; record: ReleaseRecord } {
  const record = validateTarget(source, target);
  const path = copyVerifiedRelease(source, managedDirectory(root, 'archives'), record, target);
  return { path, record };
}

function preserveAssets(source: string, root: string, record: ReleaseRecord): void {
  const assets = managedDirectory(root, 'assets');
  for (const file of record.artifacts.filter((item) => item.path.startsWith('assets/'))) {
    if (!/-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9.]+$/u.test(basename(file.path)))
      throw new Error(`Immutable assets must use fingerprinted filenames: ${file.path}`);
    const relativePath = file.path.slice('assets/'.length);
    const destination = join(assets, relativePath);
    // Create and inspect every component so an unexpected symlink cannot redirect writes.
    let directory = assets;
    for (const segment of relativePath.split('/').slice(0, -1))
      directory = managedDirectory(directory, segment);
    if (existsSync(destination)) {
      const stat = lstatSync(destination);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        sha256(readFileSync(destination)) !== file.sha256
      )
        throw new Error(`Retained asset name collision or tampering: ${file.path}`);
    } else {
      const temporary = join(dirname(destination), `.tmp-${randomUUID()}`);
      try {
        copyFileSync(join(source, file.path), temporary, constants.COPYFILE_EXCL);
        if (sha256(readFileSync(temporary)) !== file.sha256)
          throw new Error('Asset changed while being retained');
        renameSync(temporary, destination);
      } finally {
        if (existsSync(temporary)) rmSync(temporary);
      }
    }
  }
}

function activateArchived(
  source: string,
  root: string,
  record: ReleaseRecord,
  target: ReleaseTarget,
): string {
  const release = copyVerifiedRelease(source, managedDirectory(root, 'releases'), record, target);
  preserveAssets(release, root, record);
  const current = join(root, 'current');
  try {
    const stat = lstatSync(current);
    if (
      !stat.isSymbolicLink() ||
      !/^releases\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/u.test(readlinkSync(current))
    )
      throw new Error('Refusing to replace an unexpected current entry');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = join(root, `.current-${randomUUID()}`);
  try {
    symlinkSync(`releases/${record.buildId}`, temporary, 'dir');
    renameSync(temporary, current);
  } finally {
    try {
      if (lstatSync(temporary).isSymbolicLink()) rmSync(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return release;
}

export function archiveRelease(
  outDir: string,
  targetDirectory: string,
  target: ReleaseTarget,
): string {
  validateTarget(outDir, target);
  const root = safeTargetRoot(targetDirectory, target, outDir);
  return withTargetLock(root, () => archiveUnlocked(outDir, root, target).path);
}

/** Archive verified bytes first, then switch one relative symlink atomically. */
export function deployRelease(
  outDir: string,
  targetDirectory: string,
  target: ReleaseTarget,
): string {
  validateTarget(outDir, target);
  const root = safeTargetRoot(targetDirectory, target, outDir);
  return withTargetLock(root, () => {
    const archive = archiveUnlocked(outDir, root, target);
    return activateArchived(archive.path, root, archive.record, target);
  });
}

export function rollbackRelease(
  buildId: string,
  targetDirectory: string,
  target: ReleaseTarget,
): string {
  safeIdentifier(buildId, 'Rollback buildId');
  const root = safeTargetRoot(targetDirectory, target);
  return withTargetLock(root, () => {
    const archives = join(root, 'archives');
    regularDirectory(archives);
    const path = join(archives, buildId);
    const record = validateTarget(path, target);
    if (record.buildId !== buildId)
      throw new Error('Archive identifier does not match release record');
    return activateArchived(path, root, record, target);
  });
}

function argumentsFor(command: string, args: string[]): Map<string, string> {
  const allowed = new Set([
    '--profile',
    '--mode',
    '--backend-policy',
    ...(command === 'verify'
      ? ['--artifact']
      : command === 'rollback'
        ? ['--target', '--release']
        : ['--target', '--artifact']),
  ]);
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !allowed.has(key) || !value || value.startsWith('--') || options.has(key))
      throw new Error(`Invalid or duplicate release argument: ${key ?? ''}`);
    options.set(key, value);
  }
  for (const key of allowed)
    if (!options.has(key)) throw new Error(`Missing required release argument: ${key}`);
  return options;
}

export function runReleaseCli(args: string[]): void {
  const command = args[0];
  if (!command || !['verify', 'archive', 'deploy', 'rollback'].includes(command))
    throw new Error(
      'Usage: release-cli.ts <verify|archive|deploy|rollback> --profile ID --mode ENV --backend-policy FILE [--artifact DIR] [--target DIR] [--release BUILD_ID]',
    );
  const options = argumentsFor(command, args.slice(1));
  const profileId = options.get('--profile')!;
  safeIdentifier(profileId, 'Target profileId');
  const target: ReleaseTarget = {
    profileId,
    environment: environment(options.get('--mode')),
    backendPolicy: parseBackendPolicy(
      JSON.parse(readFileSync(resolve(options.get('--backend-policy')!), 'utf8')),
    ),
  };
  const artifact = options.get('--artifact');
  const destination = options.get('--target');
  if (command === 'verify') {
    const record = validateTarget(resolve(artifact!), target);
    process.stdout.write(
      `Verified ${record.profileId}/${record.environment} release ${record.buildId} (${record.artifacts.length} files)\n`,
    );
  } else {
    const path =
      command === 'archive'
        ? archiveRelease(resolve(artifact!), resolve(destination!), target)
        : command === 'deploy'
          ? deployRelease(resolve(artifact!), resolve(destination!), target)
          : rollbackRelease(options.get('--release')!, resolve(destination!), target);
    process.stdout.write(`${command}: ${path}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runReleaseCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `Release rejected: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
