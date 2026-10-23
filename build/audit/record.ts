import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildMode, loadPolicy } from '../policy/manifest.ts';
import { assertAllowed, assertEdge, identify, originPath } from '../policy/origin.ts';
import type { Origin, Policy, SourceEdge, SourceEvidence } from '../policy/types.ts';
import {
  canonical,
  identifier,
  keys,
  POLICY_VERSION,
  readJson,
  record,
  sha256,
  strings,
} from '../utils.ts';
import { freezeOutputs, siteHash, verifyFiles } from './files.ts';
import type {
  AuditRecord,
  Collector,
  ContextEvidence,
  ModuleEvidence,
  OutputEvidence,
} from './types.ts';

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`INVALID_AUDIT_FIELD: ${field}`);
  return value;
}
function hash(value: unknown, field: string): string {
  const result = text(value, field);
  if (!/^[a-f0-9]{64}$/u.test(result)) throw new Error(`INVALID_HASH: ${field}`);
  return result;
}
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('INVALID_AUDIT_LIST');
  return value.map(parse);
}

function origin(value: unknown, policy: Policy): Origin {
  const raw = record(value, 'origin');
  const id = text(raw.id, 'origin.id');
  const actual = identify(policy, originPath(policy, id));
  if (actual.id !== id || actual.kind !== raw.kind || actual.owner !== raw.owner)
    throw new Error(`ORIGIN_MISMATCH: ${id}`);
  assertAllowed(policy, actual);
  return actual;
}

function output(value: unknown, policy: Policy): OutputEvidence {
  const raw = record(value, 'output');
  keys(raw, ['path', 'sha256', 'bytes', 'kind', 'producer', 'inputs', 'imports'], 'output');
  if (typeof raw.bytes !== 'number' || !Number.isSafeInteger(raw.bytes) || raw.bytes < 0)
    throw new Error('INVALID_OUTPUT_SIZE');
  const kind = raw.kind;
  const producer = raw.producer;
  if (kind !== 'chunk' && kind !== 'style' && kind !== 'asset' && kind !== 'html')
    throw new Error('INVALID_OUTPUT_KIND');
  if (producer !== 'vite' && producer !== 'rolldown' && producer !== 'worker')
    throw new Error('UNREGISTERED_PRODUCER');
  const inputs = list(raw.inputs, (item) => origin(item, policy));
  if (!inputs.length) throw new Error('UNOWNED_OUTPUT');
  return {
    path: text(raw.path, 'path'),
    sha256: hash(raw.sha256, 'output.sha256'),
    bytes: raw.bytes,
    kind,
    producer,
    inputs,
    imports: strings(raw.imports, 'output.imports'),
  };
}

function context(value: unknown, policy: Policy): ContextEvidence {
  const raw = record(value, 'context');
  keys(raw, ['id', 'kind', 'status', 'modules', 'outputs'], 'context');
  if ((raw.kind !== 'app' && raw.kind !== 'worker') || raw.status !== 'success')
    throw new Error('INCOMPLETE_CONTEXT');
  const modules = list(raw.modules, (item): ModuleEvidence => {
    const module = record(item, 'module');
    keys(module, ['id', 'owner', 'kind', 'sha256', 'imports', 'dynamicImports', 'entry'], 'module');
    if (typeof module.entry !== 'boolean') throw new Error('INVALID_MODULE_ENTRY');
    const from = origin(module, policy);
    const imports = strings(module.imports, 'imports');
    const dynamicImports = strings(module.dynamicImports, 'dynamicImports');
    for (const id of [...imports, ...dynamicImports])
      assertEdge(policy, from, identify(policy, originPath(policy, id)));
    return {
      ...from,
      sha256: hash(module.sha256, 'module.sha256'),
      imports,
      dynamicImports,
      entry: module.entry,
    };
  });
  if (!modules.length) throw new Error('EMPTY_CONTEXT');
  return {
    id: identifier(raw.id, 'contextId'),
    kind: raw.kind,
    status: 'success',
    modules,
    outputs: list(raw.outputs, (item) => output(item, policy)),
  };
}

function sourceEvidence(value: unknown, policy: Policy): SourceEvidence {
  const raw = record(value, 'sources');
  keys(raw, ['inputs', 'edges', 'workers'], 'sources');
  const inputs = list(raw.inputs, (item) => {
    const rawInput = record(item, 'source');
    keys(rawInput, ['id', 'kind', 'owner', 'sha256'], 'source');
    return { ...origin(rawInput, policy), sha256: hash(rawInput.sha256, 'source.sha256') };
  });
  if (!inputs.length || new Set(inputs.map((item) => item.id)).size !== inputs.length)
    throw new Error('INVALID_SOURCE_MANIFEST');
  const edges = list(raw.edges, (item): SourceEdge => {
    const edge = record(item, 'edge');
    keys(edge, ['from', 'to', 'kind'], 'edge');
    if (edge.kind !== 'import' && edge.kind !== 'resource' && edge.kind !== 'worker')
      throw new Error('INVALID_EDGE_KIND');
    const from = text(edge.from, 'edge.from');
    const to = text(edge.to, 'edge.to');
    assertEdge(
      policy,
      identify(policy, originPath(policy, from)),
      identify(policy, originPath(policy, to)),
    );
    return { from, to, kind: edge.kind };
  });
  const workers = strings(raw.workers, 'workers');
  for (const id of workers) assertAllowed(policy, identify(policy, originPath(policy, id)));
  return { inputs, edges, workers };
}

export function verifyContexts(
  sources: SourceEvidence,
  contexts: readonly ContextEvidence[],
): void {
  if (
    contexts.filter((item) => item.kind === 'app').length !== 1 ||
    new Set(contexts.map((item) => item.id)).size !== contexts.length
  )
    throw new Error('INVALID_CONTEXT_SET');
  const actualWorkers = contexts
    .filter((item) => item.kind === 'worker')
    .flatMap((item) => item.modules.filter((module) => module.entry).map((module) => module.id))
    .sort();
  if (canonical(actualWorkers) !== canonical([...sources.workers].sort()))
    throw new Error('WORKER_CONTEXT_MISMATCH');
  const fingerprints = new Map(sources.inputs.map((item) => [item.id, item.sha256]));
  const proven = new Set(sources.inputs.map((item) => item.id));
  for (const item of contexts)
    for (const module of item.modules) {
      proven.add(module.id);
      if (fingerprints.has(module.id) && fingerprints.get(module.id) !== module.sha256)
        throw new Error(`SOURCE_CHANGED_DURING_BUILD: ${module.id}`);
    }
  for (const item of contexts)
    for (const file of item.outputs)
      for (const input of file.inputs)
        if (!proven.has(input.id) && input.kind !== 'generated')
          throw new Error(`UNPROVEN_OUTPUT_SOURCE: ${input.id}`);
}

export function toolchain(root: string): Readonly<Record<string, string>> {
  const result: Record<string, string> = {
    node: process.versions.node,
    packager: 'system-tar-gzip',
  };
  for (const name of [
    'vite',
    'rolldown',
    'vue',
    'vue-router',
    '@vitejs/plugin-vue',
    '@vue/compiler-sfc',
    'typescript',
  ]) {
    const raw = record(readJson(resolve(root, 'node_modules', name, 'package.json')), name);
    result[name] = text(raw.version, `version:${name}`);
  }
  return result;
}

export function cacheKey(
  value: Pick<
    AuditRecord,
    'sourceTreeHash' | 'configHash' | 'policyHash' | 'lockfileHash' | 'mode' | 'toolchain'
  >,
): string {
  return sha256(
    canonical({
      sourceTreeHash: value.sourceTreeHash,
      configHash: value.configHash,
      policyHash: value.policyHash,
      lockfileHash: value.lockfileHash,
      mode: value.mode,
      toolchain: value.toolchain,
    }),
  );
}

export function parseAudit(value: unknown, policy: Policy): AuditRecord {
  const raw = record(value, 'audit');
  keys(
    raw,
    [
      'schemaVersion',
      'policyVersion',
      'enterpriseId',
      'releaseId',
      'mode',
      'brandingId',
      'enabledModules',
      'sourceCommit',
      'sourceDirty',
      'sourceTreeHash',
      'configHash',
      'policyHash',
      'lockfileHash',
      'cacheKey',
      'createdAt',
      'toolchain',
      'registryHash',
      'sources',
      'contexts',
      'notApplicable',
      'files',
      'siteHash',
      'checks',
    ],
    'audit',
  );
  if (
    raw.schemaVersion !== 1 ||
    raw.policyVersion !== POLICY_VERSION ||
    raw.enterpriseId !== policy.enterprise.enterpriseId ||
    raw.brandingId !== policy.brand.id
  )
    throw new Error('AUDIT_IDENTITY_MISMATCH');
  if (typeof raw.sourceDirty !== 'boolean') throw new Error('INVALID_SOURCE_STATUS');
  const enabledModules = strings(raw.enabledModules, 'enabledModules');
  if (canonical(enabledModules) !== canonical(policy.selected.map((item) => item.id)))
    throw new Error('AUDIT_MODULE_MISMATCH');
  if (
    raw.configHash !== policy.configHash ||
    raw.policyHash !== policy.policyHash ||
    raw.lockfileHash !== policy.lockfileHash
  )
    throw new Error('AUDIT_POLICY_MISMATCH');
  const tools = record(raw.toolchain, 'toolchain');
  if (
    Object.values(tools).some((item) => typeof item !== 'string') ||
    canonical(tools) !== canonical(toolchain(policy.root))
  )
    throw new Error('TOOLCHAIN_MISMATCH');
  const parsedTools: Record<string, string> = {};
  for (const [key, value] of Object.entries(tools)) parsedTools[key] = text(value, 'tool version');
  const checks = record(raw.checks, 'checks');
  if (
    canonical(checks) !==
    canonical({
      forbiddenSources: 0,
      unknownSources: 0,
      fileDifferences: 0,
      sourceBoundaries: 'passed',
      buildGraphs: 'passed',
      finalFiles: 'passed',
    })
  )
    throw new Error('AUDIT_NOT_PASSED');
  const contexts = list(raw.contexts, (item) => context(item, policy));
  const sources = sourceEvidence(raw.sources, policy);
  verifyContexts(sources, contexts);
  const files = list(raw.files, (item) => output(item, policy));
  if (canonical(files) !== canonical(freezeOutputs(policy, { contexts })))
    throw new Error('OUTPUT_EVIDENCE_MISMATCH');
  const notApplicable = list(raw.notApplicable, (item) => {
    const entry = record(item, 'notApplicable');
    keys(entry, ['context', 'reason'], 'notApplicable');
    return { context: text(entry.context, 'context'), reason: text(entry.reason, 'reason') };
  });
  const requiredNA = [
    'service-worker',
    'ssr',
    'independent-entry',
    ...(sources.workers.length ? [] : ['worker']),
  ].sort();
  if (canonical(notApplicable.map((item) => item.context).sort()) !== canonical(requiredNA))
    throw new Error('CONTEXT_DECLARATION_MISMATCH');
  const result: AuditRecord = {
    schemaVersion: 1,
    policyVersion: POLICY_VERSION,
    enterpriseId: policy.enterprise.enterpriseId,
    releaseId: identifier(raw.releaseId, 'releaseId'),
    mode: buildMode(raw.mode),
    brandingId: policy.brand.id,
    enabledModules,
    sourceCommit: text(raw.sourceCommit, 'sourceCommit'),
    sourceDirty: raw.sourceDirty,
    sourceTreeHash: hash(raw.sourceTreeHash, 'sourceTreeHash'),
    configHash: policy.configHash,
    policyHash: policy.policyHash,
    lockfileHash: policy.lockfileHash,
    cacheKey: hash(raw.cacheKey, 'cacheKey'),
    createdAt: text(raw.createdAt, 'createdAt'),
    toolchain: parsedTools,
    registryHash: hash(raw.registryHash, 'registryHash'),
    sources,
    contexts,
    notApplicable,
    files,
    siteHash: hash(raw.siteHash, 'siteHash'),
    checks: {
      forbiddenSources: 0,
      unknownSources: 0,
      fileDifferences: 0,
      sourceBoundaries: 'passed',
      buildGraphs: 'passed',
      finalFiles: 'passed',
    },
  };
  if (result.siteHash !== siteHash(files) || result.cacheKey !== cacheKey(result))
    throw new Error('AUDIT_DIGEST_MISMATCH');
  return result;
}

export function buildPaths(root: string, enterpriseId: string, releaseId: string) {
  identifier(enterpriseId, 'enterpriseId');
  identifier(releaseId, 'releaseId');
  return {
    work: resolve(root, '.work', enterpriseId, releaseId),
    site: resolve(root, '.work', enterpriseId, releaseId, 'site'),
    audit: resolve(root, '.audit', enterpriseId, releaseId),
    release: resolve(root, 'release', enterpriseId, releaseId),
    archive: resolve(root, '.artifacts', enterpriseId, `${releaseId}.tar.gz`),
  };
}

export function auditBuild(
  root: string,
  enterpriseId: string,
  releaseId: string,
  site?: string,
): AuditRecord {
  const policy = loadPolicy(root, enterpriseId);
  const paths = buildPaths(root, enterpriseId, releaseId);
  if (existsSync(resolve(paths.audit, 'failed.json'))) throw new Error('BUILD_FAILED');
  const audit = parseAudit(readJson(resolve(paths.audit, 'audit.json')), policy);
  if (audit.releaseId !== releaseId) throw new Error('RELEASE_ID_MISMATCH');
  verifyFiles(site ?? paths.site, audit.files);
  return audit;
}

export function assertSnapshot(policy: Policy, sources: SourceEvidence): void {
  for (const item of sources.inputs) {
    if (sha256(readFileSync(originPath(policy, item.id))) !== item.sha256)
      throw new Error(`SOURCE_CHANGED_DURING_BUILD: ${item.id}`);
  }
  const current = loadPolicy(policy.root, policy.enterprise.enterpriseId);
  if (
    current.configHash !== policy.configHash ||
    current.policyHash !== policy.policyHash ||
    current.lockfileHash !== policy.lockfileHash
  )
    throw new Error('POLICY_CHANGED_DURING_BUILD');
}

export function saveAudit(directory: string, audit: AuditRecord): void {
  writeFileSync(resolve(directory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`, {
    flag: 'wx',
  });
}

export function qualifyOutputs(
  policy: Policy,
  collector: Collector,
  sources: SourceEvidence,
  site: string,
): OutputEvidence[] {
  verifyContexts(sources, collector.contexts);
  const files = freezeOutputs(policy, collector);
  verifyFiles(site, files);
  assertSnapshot(policy, sources);
  return files;
}
