import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MODULE_IDS, type BuildProfile, type ModuleId } from '../shared/build-profile.ts';
import { parseBuildProfile } from './load-profile.ts';

export const RELEASE_RECORD_FILE = 'release-record.json';
export const ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export interface BackendCompatibility {
  policyVersion: string;
  contractVersion: string;
  requiredCapabilities: string[];
}

export interface BackendPolicy {
  schemaVersion: 1;
  policyVersion: string;
  profileId: string;
  environment: Environment;
  contractVersion: string;
  capabilities: string[];
}

export interface ArtifactFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ReleaseRecord {
  schemaVersion: 1;
  profileId: string;
  environment: Environment;
  appVersion: string;
  gitCommit: string;
  sourceState: { dirty: boolean; digest: string };
  profile: BuildProfile;
  profileDigest: string;
  enabledModules: ModuleId[];
  buildId: string;
  builtAt: string;
  toolchain: { node: string; npm: string; vite: string; typescript: string };
  lockfile: { path: 'package-lock.json'; sha256: string };
  buildCommand: string;
  backendCompatibility: BackendCompatibility;
  directories: string[];
  artifacts: ArtifactFile[];
  artifactDigest: string;
}

export interface ReleaseRecordOptions {
  outDir: string;
  profile: BuildProfile;
  mode: string;
  rootDir?: string;
  buildCommand?: string;
  buildId?: string;
  gitCommit?: string;
  backendCompatibility: BackendCompatibility;
}

export interface ReleaseTarget {
  profileId: string;
  environment: string;
  backendPolicy: BackendPolicy;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    throw new Error(`${label} has missing or unknown fields`);
  }
}

function nonempty(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > 1024 ||
    /[\u0000-\u001f]/u.test(value)
  ) {
    throw new Error(`${label} must be a nonempty, single-line string`);
  }
}

export function safeIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/u.test(value)) {
    throw new Error(`${label} must be a safe identifier`);
  }
}

export function environment(value: unknown): Environment {
  if (!ENVIRONMENTS.includes(value as Environment))
    throw new Error(`Unsupported environment: ${String(value)}`);
  return value as Environment;
}

function digest(value: unknown, label: string): void {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value))
    throw new Error(`${label} must be a SHA-256 digest`);
}

function stringList(value: unknown, label: string): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) => typeof item !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/u.test(item),
    ) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${label} must contain unique capability identifiers`);
  }
}

export function parseBackendCompatibility(value: unknown): BackendCompatibility {
  const data = object(value, 'Backend compatibility');
  keys(data, ['policyVersion', 'contractVersion', 'requiredCapabilities'], 'Backend compatibility');
  nonempty(data.policyVersion, 'policyVersion');
  nonempty(data.contractVersion, 'contractVersion');
  stringList(data.requiredCapabilities, 'requiredCapabilities');
  return {
    policyVersion: data.policyVersion,
    contractVersion: data.contractVersion,
    requiredCapabilities: [...data.requiredCapabilities].sort(),
  };
}

export function parseBackendPolicy(value: unknown): BackendPolicy {
  const data = object(value, 'Backend policy');
  keys(
    data,
    [
      'schemaVersion',
      'policyVersion',
      'profileId',
      'environment',
      'contractVersion',
      'capabilities',
    ],
    'Backend policy',
  );
  if (data.schemaVersion !== 1) throw new Error('Unsupported backend policy schema');
  safeIdentifier(data.profileId, 'Backend profileId');
  nonempty(data.policyVersion, 'policyVersion');
  nonempty(data.contractVersion, 'contractVersion');
  stringList(data.capabilities, 'capabilities');
  return {
    schemaVersion: 1,
    policyVersion: data.policyVersion,
    profileId: data.profileId,
    environment: environment(data.environment),
    contractVersion: data.contractVersion,
    capabilities: [...data.capabilities].sort(),
  };
}

function artifactPath(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    value === RELEASE_RECORD_FILE ||
    value.includes('\\') ||
    value.startsWith('/') ||
    value
      .split('/')
      .some((part) => !part || part === '.' || part === '..' || /[\u0000-\u001f]/u.test(part))
  ) {
    throw new Error(`Unsafe artifact path: ${String(value)}`);
  }
}

/** Enumerate bytes actually shipped; never follow symbolic links or special files. */
export function scanArtifacts(outDir: string): {
  artifacts: ArtifactFile[];
  directories: string[];
} {
  const root = resolve(outDir);
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink())
    throw new Error('Artifact root must be a regular directory');
  const artifacts: ArtifactFile[] = [];
  const directories: string[] = [];
  function visit(relative: string): void {
    for (const entry of readdirSync(join(root, relative)).sort()) {
      const path = relative ? `${relative}/${entry}` : entry;
      const stat = lstatSync(join(root, path));
      if (stat.isSymbolicLink())
        throw new Error(`Symbolic links are forbidden in artifacts: ${path}`);
      if (path === RELEASE_RECORD_FILE) {
        if (!stat.isFile()) throw new Error('Release record must be a regular file');
        continue;
      }
      artifactPath(path);
      if (stat.isDirectory()) {
        directories.push(path);
        visit(path);
      } else if (stat.isFile()) {
        const bytes = readFileSync(join(root, path));
        artifacts.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
      } else throw new Error(`Unsupported artifact type: ${path}`);
    }
  }
  visit('');
  artifacts.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  directories.sort();
  if (!artifacts.some((file) => file.path === 'index.html'))
    throw new Error('Artifact must include index.html');
  return { artifacts, directories };
}

function commandOutput(command: string, args: string[], cwd: string, fallback?: string): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

function sourceState(root: string): ReleaseRecord['sourceState'] {
  // Only named public build inputs participate; .env.local and other secret files
  // are never read. Untracked inputs are included just like tracked inputs.
  const roots = [
    'build',
    'config',
    'shared',
    'src',
    'index.html',
    'package.json',
    'package-lock.json',
    '.env.development',
    '.env.staging',
    '.env.production',
    ...readdirSync(root).filter(
      (name) => /^tsconfig.*\.json$/u.test(name) || /^vite\.config\.[cm]?[jt]s$/u.test(name),
    ),
  ];
  const inputs: Array<{ path: string; sha256: string }> = [];
  function visit(path: string): void {
    const absolute = join(root, path);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink())
      throw new Error(`Public build source must not be a symbolic link: ${path}`);
    if (stat.isDirectory())
      for (const name of readdirSync(absolute).sort()) visit(`${path}/${name}`);
    else if (stat.isFile()) inputs.push({ path, sha256: sha256(readFileSync(absolute)) });
    else throw new Error(`Unsupported public build source: ${path}`);
  }
  for (const path of [...new Set(roots)].sort()) if (existsSync(join(root, path))) visit(path);
  inputs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    dirty:
      commandOutput(
        'git',
        ['status', '--porcelain', '--untracked-files=normal'],
        root,
        'unavailable',
      ).length !== 0,
    digest: sha256(canonicalJson(inputs)),
  };
}

export function createReleaseRecord(options: ReleaseRecordOptions): ReleaseRecord {
  const root = resolve(options.rootDir ?? process.cwd());
  const profile = parseBuildProfile(options.profile, options.profile.id);
  const mode = environment(options.mode);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    version: string;
  };
  nonempty(manifest.version, 'appVersion');
  const lockBytes = readFileSync(join(root, 'package-lock.json'));
  const lock = JSON.parse(lockBytes.toString()) as {
    packages: Record<string, { version?: string }>;
  };
  const packageVersion = (name: string): string => {
    const version = lock.packages?.[`node_modules/${name}`]?.version;
    nonempty(version, `Toolchain ${name}`);
    return version;
  };
  const buildId = options.buildId ?? randomUUID();
  safeIdentifier(buildId, 'buildId');
  const files = scanArtifacts(options.outDir);
  const record: ReleaseRecord = {
    schemaVersion: 1,
    profileId: profile.id,
    environment: mode,
    appVersion: manifest.version,
    gitCommit:
      options.gitCommit ?? commandOutput('git', ['rev-parse', 'HEAD'], root, 'unversioned'),
    sourceState: sourceState(root),
    profile,
    profileDigest: sha256(canonicalJson(profile)),
    enabledModules: MODULE_IDS.filter((id) => profile.modules[id]),
    buildId,
    builtAt: new Date().toISOString(),
    toolchain: {
      node: process.version,
      npm: commandOutput('npm', ['--version'], root),
      vite: packageVersion('vite'),
      typescript: packageVersion('typescript'),
    },
    lockfile: { path: 'package-lock.json', sha256: sha256(lockBytes) },
    buildCommand:
      options.buildCommand ?? `APP_PROFILE=${profile.id} npm run build -- --mode ${mode}`,
    backendCompatibility: parseBackendCompatibility(options.backendCompatibility),
    ...files,
    artifactDigest: sha256(canonicalJson(files)),
  };
  return parseReleaseRecord(record);
}

export function writeReleaseRecord(options: ReleaseRecordOptions): ReleaseRecord {
  const record = createReleaseRecord(options);
  writeFileSync(join(options.outDir, RELEASE_RECORD_FILE), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export function parseReleaseRecord(value: unknown): ReleaseRecord {
  const data = object(value, 'Release record');
  keys(
    data,
    [
      'schemaVersion',
      'profileId',
      'environment',
      'appVersion',
      'gitCommit',
      'sourceState',
      'profile',
      'profileDigest',
      'enabledModules',
      'buildId',
      'builtAt',
      'toolchain',
      'lockfile',
      'buildCommand',
      'backendCompatibility',
      'directories',
      'artifacts',
      'artifactDigest',
    ],
    'Release record',
  );
  if (data.schemaVersion !== 1) throw new Error('Unsupported release record schema');
  safeIdentifier(data.profileId, 'profileId');
  safeIdentifier(data.buildId, 'buildId');
  environment(data.environment);
  for (const field of ['appVersion', 'gitCommit', 'buildCommand', 'builtAt'])
    nonempty(data[field], field);
  if (
    data.gitCommit !== 'unversioned' &&
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(data.gitCommit as string)
  )
    throw new Error('gitCommit must be a complete Git commit identifier or unversioned');
  if (Number.isNaN(Date.parse(data.builtAt as string))) throw new Error('Invalid build timestamp');
  const source = object(data.sourceState, 'Source state');
  keys(source, ['dirty', 'digest'], 'Source state');
  if (typeof source.dirty !== 'boolean') throw new Error('Source dirty status must be a boolean');
  digest(source.digest, 'Source snapshot digest');
  const profile = parseBuildProfile(data.profile, data.profileId);
  digest(data.profileDigest, 'profileDigest');
  if (data.profileDigest !== sha256(canonicalJson(profile)))
    throw new Error('Archived profile digest mismatch');
  if (
    canonicalJson(data.enabledModules) !==
    canonicalJson(MODULE_IDS.filter((id) => profile.modules[id]))
  )
    throw new Error('Enabled module list does not match archived profile');
  const toolchain = object(data.toolchain, 'Toolchain');
  keys(toolchain, ['node', 'npm', 'vite', 'typescript'], 'Toolchain');
  for (const [key, version] of Object.entries(toolchain)) nonempty(version, `Toolchain ${key}`);
  const lockfile = object(data.lockfile, 'Lockfile');
  keys(lockfile, ['path', 'sha256'], 'Lockfile');
  if (lockfile.path !== 'package-lock.json') throw new Error('Unexpected lockfile path');
  digest(lockfile.sha256, 'Lockfile digest');
  parseBackendCompatibility(data.backendCompatibility);
  if (!Array.isArray(data.directories)) throw new Error('Missing artifact directories');
  for (const path of data.directories) artifactPath(path);
  if (canonicalJson(data.directories) !== canonicalJson([...new Set(data.directories)].sort()))
    throw new Error('Artifact directories must be sorted and unique');
  if (!Array.isArray(data.artifacts) || data.artifacts.length === 0)
    throw new Error('Missing artifact file list');
  for (const item of data.artifacts) {
    const file = object(item, 'Artifact file');
    keys(file, ['path', 'bytes', 'sha256'], 'Artifact file');
    artifactPath(file.path);
    digest(file.sha256, 'File digest');
    if (!Number.isSafeInteger(file.bytes) || (file.bytes as number) < 0)
      throw new Error('Invalid artifact file size');
  }
  const paths = data.artifacts.map((item: ArtifactFile) => item.path);
  if (
    canonicalJson(paths) !== canonicalJson([...new Set(paths)].sort()) ||
    !paths.includes('index.html')
  )
    throw new Error('Artifact paths must be sorted, unique, and include index.html');
  digest(data.artifactDigest, 'artifactDigest');
  if (
    data.artifactDigest !==
    sha256(canonicalJson({ artifacts: data.artifacts, directories: data.directories }))
  )
    throw new Error('Artifact inventory digest mismatch');
  return data as unknown as ReleaseRecord;
}

/** Validate historical metadata against its archived profile, then verify every byte and target. */
export function validateTarget(outDir: string, target: ReleaseTarget): ReleaseRecord {
  safeIdentifier(target.profileId, 'Target profileId');
  const mode = environment(target.environment);
  const recordPath = join(outDir, RELEASE_RECORD_FILE);
  const recordStat = lstatSync(recordPath);
  if (!recordStat.isFile() || recordStat.isSymbolicLink())
    throw new Error('Release record must be a regular file');
  const record = parseReleaseRecord(JSON.parse(readFileSync(recordPath, 'utf8')));
  if (record.profileId !== target.profileId || record.environment !== mode)
    throw new Error('Release profile/environment does not match deployment target');
  const policy = parseBackendPolicy(target.backendPolicy);
  if (policy.profileId !== target.profileId || policy.environment !== mode)
    throw new Error('Backend policy profile/environment does not match target');
  if (
    policy.policyVersion !== record.backendCompatibility.policyVersion ||
    policy.contractVersion !== record.backendCompatibility.contractVersion ||
    record.backendCompatibility.requiredCapabilities.some(
      (capability) => !policy.capabilities.includes(capability),
    )
  ) {
    throw new Error('Backend compatibility check failed');
  }
  if (
    canonicalJson(scanArtifacts(outDir)) !==
    canonicalJson({ artifacts: record.artifacts, directories: record.directories })
  )
    throw new Error('Artifact integrity check failed: changed, missing, or extra files');
  return record;
}
