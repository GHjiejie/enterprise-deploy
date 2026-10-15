import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  MODULE_IDS,
  type BuildMode,
  type BuildProfile,
  type ModuleId,
} from '../shared/build-profile.ts';

export const PRUNING_REPORT_FILE = 'pruning-report.json';
export const CHECKER_VERSION = '1.0.0';
export const OWNERSHIP_POLICY_VERSION = 1;
export const MODULE_ROOTS: Readonly<Record<ModuleId, string>> = {
  modelCatalog: 'src/modules/model-catalog/',
  chat: 'src/modules/chat/',
  imageStudio: 'src/modules/image-studio/',
  videoStudio: 'src/modules/video-studio/',
};
export const OWNERSHIP_POLICY = {
  version: OWNERSHIP_POLICY_VERSION,
  moduleRoots: MODULE_ROOTS,
  sharedRoots: ['shared/', 'src/shared/'],
  platformRoots: ['src/app/', 'src/platform/'],
  platformFiles: ['index.html', 'src/main.tsx', 'src/styles.css'],
  vendorRoot: 'node_modules/',
  virtualModules: [
    'virtual:enterprise-modules',
    'vite/modulepreload-polyfill.js',
    'vite/preload-helper.js',
    'rolldown/runtime.js',
  ],
  rules: [
    'no-disabled-graph',
    'no-private-cross-import',
    'no-unknown-output',
    'no-external-code',
    'no-source-maps',
    'css-ast-provenance-v1',
    'url-provenance-v1',
    'no-unregistered-virtual',
    'no-empty-output-dirs',
    'no-worker-without-adapter',
  ],
} as const;

export function pruningCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pruningCanonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const data = value as Record<string, unknown>;
    return `{${Object.keys(data)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${pruningCanonical(data[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function pruningHash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
export const OWNERSHIP_POLICY_DIGEST = pruningHash(pruningCanonical(OWNERSHIP_POLICY));

export type PruningOwner = ModuleId | 'platform' | 'shared' | 'vendor';
export type PruningFileKind = 'script' | 'style' | 'html' | 'asset';
export interface PruningFile {
  path: string;
  bytes: number;
  sha256: string;
  owners: PruningOwner[];
  kind: PruningFileKind;
}
export interface PruningReference {
  reportPath: typeof PRUNING_REPORT_FILE;
  reportSha256: string;
  checkerVersion: string;
  ownershipPolicyVersion: number;
  ownershipPolicyDigest: string;
}
export interface PruningReport {
  schemaVersion: 1;
  checkerVersion: string;
  ownershipPolicyVersion: number;
  ownershipPolicyDigest: string;
  buildId: string;
  profileId: string;
  environment: BuildMode;
  profileDigest: string;
  enabledModules: ModuleId[];
  excludedModules: ModuleId[];
  emittedModuleIds: ModuleId[];
  graphCheck: 'passed';
  resourceCheck: 'passed';
  graphModuleCount: number;
  files: PruningFile[];
}
export interface PruningContext {
  profile: BuildProfile;
  environment: BuildMode;
  buildId: string;
}
export interface PruningEvidence {
  files: ReadonlyMap<
    string,
    { owners: readonly PruningOwner[]; kind: PruningFileKind; sha256: string }
  >;
  emittedModuleIds: readonly ModuleId[];
  graphModuleCount: number;
}
export interface PruningRecord {
  schemaVersion: number;
  profileId: string;
  environment: string;
  buildId: string;
  profileDigest: string;
  enabledModules: readonly ModuleId[];
  pruning?: PruningReference;
  artifacts: readonly { path: string; bytes: number; sha256: string }[];
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function exactKeys(data: Record<string, unknown>, fields: readonly string[], label: string): void {
  if (pruningCanonical(Object.keys(data).sort()) !== pruningCanonical([...fields].sort()))
    throw new Error(`${label} has missing or unknown fields`);
}
function digest(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value))
    throw new Error('Invalid pruning digest');
}
function identifier(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/u.test(value))
    throw new Error('Invalid pruning identity');
}
export function assertPruningPath(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value
      .split('/')
      .some((part) => !part || part === '.' || part === '..' || /[\u0000-\u001f]/u.test(part))
  )
    throw new Error(`Unsafe pruning path: ${String(value)}`);
}
function moduleList(value: unknown, label: string): asserts value is ModuleId[] {
  if (
    !Array.isArray(value) ||
    value.some((id) => !MODULE_IDS.includes(id)) ||
    pruningCanonical(value) !== pruningCanonical(MODULE_IDS.filter((id) => value.includes(id)))
  )
    throw new Error(`Invalid pruning ${label}`);
}

export function parsePruningReference(value: unknown): PruningReference {
  const data = object(value, 'Pruning reference');
  exactKeys(
    data,
    [
      'reportPath',
      'reportSha256',
      'checkerVersion',
      'ownershipPolicyVersion',
      'ownershipPolicyDigest',
    ],
    'Pruning reference',
  );
  if (
    data.reportPath !== PRUNING_REPORT_FILE ||
    typeof data.checkerVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/u.test(data.checkerVersion) ||
    !Number.isSafeInteger(data.ownershipPolicyVersion) ||
    Number(data.ownershipPolicyVersion) < 1
  )
    throw new Error('Unsupported pruning reference');
  digest(data.reportSha256);
  digest(data.ownershipPolicyDigest);
  return data as unknown as PruningReference;
}

export function parsePruningReport(value: unknown): PruningReport {
  const data = object(value, 'Pruning report');
  exactKeys(
    data,
    [
      'schemaVersion',
      'checkerVersion',
      'ownershipPolicyVersion',
      'ownershipPolicyDigest',
      'buildId',
      'profileId',
      'environment',
      'profileDigest',
      'enabledModules',
      'excludedModules',
      'emittedModuleIds',
      'graphCheck',
      'resourceCheck',
      'graphModuleCount',
      'files',
    ],
    'Pruning report',
  );
  if (
    data.schemaVersion !== 1 ||
    data.checkerVersion !== CHECKER_VERSION ||
    data.ownershipPolicyVersion !== OWNERSHIP_POLICY_VERSION ||
    data.ownershipPolicyDigest !== OWNERSHIP_POLICY_DIGEST
  )
    throw new Error('Unsupported pruning checker or ownership policy');
  identifier(data.buildId);
  identifier(data.profileId);
  digest(data.profileDigest);
  if (!['development', 'staging', 'production'].includes(String(data.environment)))
    throw new Error('Invalid pruning environment');
  moduleList(data.enabledModules, 'enabled modules');
  moduleList(data.excludedModules, 'excluded modules');
  moduleList(data.emittedModuleIds, 'emitted modules');
  const enabledModules = data.enabledModules;
  if (
    enabledModules.length === 0 ||
    pruningCanonical(data.emittedModuleIds) !== pruningCanonical(enabledModules) ||
    pruningCanonical(data.excludedModules) !==
      pruningCanonical(MODULE_IDS.filter((id) => !enabledModules.includes(id)))
  )
    throw new Error('Pruning module sets do not match');
  if (
    data.graphCheck !== 'passed' ||
    data.resourceCheck !== 'passed' ||
    !Number.isSafeInteger(data.graphModuleCount) ||
    Number(data.graphModuleCount) < 1
  )
    throw new Error('Pruning checks must pass');
  if (!Array.isArray(data.files) || data.files.length === 0)
    throw new Error('Missing pruning files');
  const paths: string[] = [];
  for (const item of data.files) {
    const file = object(item, 'Pruning file');
    exactKeys(file, ['path', 'bytes', 'sha256', 'owners', 'kind'], 'Pruning file');
    assertPruningPath(file.path);
    if (
      file.path === PRUNING_REPORT_FILE ||
      file.path === 'release-record.json' ||
      (/\.(?:map|tsx?|jsx?|vue|svelte)$/u.test(file.path) && !/\.js$/u.test(file.path))
    )
      throw new Error(`Forbidden source/report in pruning files: ${file.path}`);
    digest(file.sha256);
    if (!Number.isSafeInteger(file.bytes) || Number(file.bytes) < 0)
      throw new Error('Invalid pruning file size');
    if (!['script', 'style', 'html', 'asset'].includes(String(file.kind)))
      throw new Error('Invalid pruning file kind');
    const owners = file.owners;
    if (
      !Array.isArray(owners) ||
      owners.length === 0 ||
      owners.some(
        (owner) => !['platform', 'shared', 'vendor', ...enabledModules].includes(owner),
      ) ||
      pruningCanonical(owners) !== pruningCanonical([...new Set(owners)].sort())
    )
      throw new Error(`Forbidden or unknown owners: ${file.path}`);
    paths.push(file.path);
  }
  if (
    pruningCanonical(paths) !== pruningCanonical([...new Set(paths)].sort()) ||
    !paths.includes('index.html')
  )
    throw new Error('Pruning paths must be sorted, unique and include index.html');
  return data as unknown as PruningReport;
}

/** Exact bytes on disk. No links or special files, including nested directories. */
function inventory(outDir: string): Array<{ path: string; bytes: number; sha256: string }> {
  const root = resolve(outDir);
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error('Pruning root must be a regular directory');
  const files: Array<{ path: string; bytes: number; sha256: string }> = [];
  function visit(relative: string): void {
    for (const name of readdirSync(join(root, relative)).sort()) {
      const path = relative ? `${relative}/${name}` : name;
      assertPruningPath(path);
      const entry = lstatSync(join(root, path));
      if (entry.isSymbolicLink()) throw new Error(`Pruning rejects symbolic link: ${path}`);
      if (entry.isDirectory()) {
        if (readdirSync(join(root, path)).length === 0)
          throw new Error(`Empty or extra output directory: ${path}`);
        visit(path);
      } else if (entry.isFile()) {
        if ([PRUNING_REPORT_FILE, 'release-record.json'].includes(path)) continue;
        const bytes = readFileSync(join(root, path));
        files.push({ path, bytes: bytes.length, sha256: pruningHash(bytes) });
      } else throw new Error(`Pruning rejects special file: ${path}`);
    }
  }
  visit('');
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function writePruningReport(
  outDir: string,
  context: PruningContext,
  evidence: PruningEvidence,
): PruningReference {
  const actual = inventory(outDir);
  if (actual.length !== evidence.files.size)
    throw new Error('Pruning output has missing or extra files');
  const files: PruningFile[] = actual.map((file) => {
    const source = evidence.files.get(file.path);
    if (!source || file.sha256 !== source.sha256)
      throw new Error(`Pruning output changed after bundle inspection: ${file.path}`);
    return { ...file, owners: [...new Set(source.owners)].sort(), kind: source.kind };
  });
  const report = parsePruningReport({
    schemaVersion: 1,
    checkerVersion: CHECKER_VERSION,
    ownershipPolicyVersion: OWNERSHIP_POLICY_VERSION,
    ownershipPolicyDigest: OWNERSHIP_POLICY_DIGEST,
    buildId: context.buildId,
    profileId: context.profile.id,
    environment: context.environment,
    profileDigest: pruningHash(pruningCanonical(context.profile)),
    enabledModules: MODULE_IDS.filter((id) => context.profile.modules[id]),
    excludedModules: MODULE_IDS.filter((id) => !context.profile.modules[id]),
    emittedModuleIds: MODULE_IDS.filter((id) => evidence.emittedModuleIds.includes(id)),
    graphCheck: 'passed',
    resourceCheck: 'passed',
    graphModuleCount: evidence.graphModuleCount,
    files,
  });
  const bytes = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(join(outDir, PRUNING_REPORT_FILE), bytes);
  return {
    reportPath: PRUNING_REPORT_FILE,
    reportSha256: pruningHash(bytes),
    checkerVersion: CHECKER_VERSION,
    ownershipPolicyVersion: OWNERSHIP_POLICY_VERSION,
    ownershipPolicyDigest: OWNERSHIP_POLICY_DIGEST,
  };
}

/** Validates a trusted builder's evidence and every output byte; this is not a signature. */
export function verifyPruningArtifact(outDir: string, record: PruningRecord): PruningReport {
  if (record.schemaVersion !== 2 || !record.pruning)
    throw new Error('Physical pruning requires a V2 release record');
  const reference = parsePruningReference(record.pruning);
  const reportPath = join(outDir, reference.reportPath);
  const stat = lstatSync(reportPath);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error('Pruning report must be a regular file');
  const bytes = readFileSync(reportPath);
  if (pruningHash(bytes) !== reference.reportSha256)
    throw new Error('Pruning report checksum mismatch');
  const report = parsePruningReport(JSON.parse(bytes.toString('utf8')));
  for (const key of ['profileId', 'environment', 'buildId', 'profileDigest'] as const)
    if (report[key] !== record[key]) throw new Error(`Pruning ${key} mismatch`);
  for (const key of ['checkerVersion', 'ownershipPolicyVersion', 'ownershipPolicyDigest'] as const)
    if (report[key] !== reference[key]) throw new Error(`Pruning ${key} reference mismatch`);
  if (pruningCanonical(report.enabledModules) !== pruningCanonical(record.enabledModules))
    throw new Error('Pruning enabled module mismatch');
  const expected = report.files.map(({ path, bytes: size, sha256 }) => ({
    path,
    bytes: size,
    sha256,
  }));
  if (pruningCanonical(inventory(outDir)) !== pruningCanonical(expected))
    throw new Error('Pruning files changed, missing or extra');
  const complete = [
    ...expected,
    { path: PRUNING_REPORT_FILE, bytes: bytes.length, sha256: reference.reportSha256 },
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (pruningCanonical(complete) !== pruningCanonical(record.artifacts))
    throw new Error('Pruning and release file inventories differ');
  return report;
}
