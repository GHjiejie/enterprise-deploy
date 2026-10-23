import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { build } from 'vite';
import { createEnterpriseConfig } from './config.ts';
import { buildMode, loadPolicy } from './policy/manifest.ts';
import { scanSources } from './policy/scan.ts';
import type { BuildMode } from './policy/types.ts';
import { registrySource } from './plugins/registry.ts';
import {
  auditBuild,
  buildPaths,
  cacheKey,
  qualifyOutputs,
  saveAudit,
  toolchain,
} from './audit/record.ts';
import { siteHash } from './audit/files.ts';
import type { AuditRecord, Collector } from './audit/types.ts';
import {
  args,
  canonical,
  cli,
  filesIn,
  identifier,
  isMain,
  POLICY_VERSION,
  PROJECT_ROOT,
  sha256,
} from './utils.ts';

export async function buildEnterprise(
  root: string,
  enterpriseId: string,
  mode: BuildMode,
  releaseId: string = randomUUID(),
  options: {
    readonly source?: { readonly commit: string; readonly dirty: boolean };
    readonly onStage?: (stage: 'validating' | 'compiling' | 'auditing') => void;
  } = {},
): Promise<AuditRecord> {
  options.onStage?.('validating');
  const policy = loadPolicy(root, enterpriseId);
  buildMode(mode);
  identifier(releaseId, 'releaseId');
  const sources = scanSources(policy);
  execFileSync(
    process.execPath,
    [resolve(root, 'node_modules/vue-tsc/bin/vue-tsc.js'), '--noEmit'],
    { cwd: root, stdio: 'pipe' },
  );
  const paths = buildPaths(root, enterpriseId, releaseId);
  if (existsSync(paths.audit)) throw new Error('RELEASE_ID_ALREADY_USED');
  // Exclusive per-run reservation also makes retries unable to reuse a stale successful audit.
  mkdirSync(resolve(root, '.work', enterpriseId), { recursive: true });
  mkdirSync(paths.work);
  mkdirSync(paths.audit, { recursive: true });
  const collector: Collector = { contexts: [] };
  try {
    const sourceFiles = [
      ...filesIn(resolve(root, 'src')),
      ...filesIn(resolve(root, 'config')),
      ...filesIn(resolve(root, 'build')),
      ...['index.html', 'package.json', 'tsconfig.json', 'vite.config.ts'].map((name) =>
        resolve(root, name),
      ),
    ].sort();
    const sourceTreeHash = sha256(
      canonical(sourceFiles.map((file) => [relative(root, file), sha256(readFileSync(file))])),
    );
    let sourceCommit = 'unversioned';
    let sourceDirty = true;
    try {
      sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      sourceDirty = !!execFileSync('git', ['status', '--porcelain', '--', '.'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
    } catch {
      /* Source hashes remain available outside a Git checkout. */
    }
    if (options.source) {
      sourceCommit = options.source.commit;
      sourceDirty = options.source.dirty;
    }
    options.onStage?.('compiling');
    console.log(`[${enterpriseId}/${releaseId}] boundaries passed; building ${mode}`);
    await build(createEnterpriseConfig(policy, mode, releaseId, paths.site, collector));
    options.onStage?.('auditing');
    const files = qualifyOutputs(policy, collector, sources, paths.site);
    const tools = toolchain(root);
    const audit: AuditRecord = {
      schemaVersion: 1,
      policyVersion: POLICY_VERSION,
      enterpriseId,
      releaseId,
      mode,
      brandingId: policy.brand.id,
      enabledModules: policy.selected.map((item) => item.id),
      sourceCommit,
      sourceDirty,
      sourceTreeHash,
      configHash: policy.configHash,
      policyHash: policy.policyHash,
      lockfileHash: policy.lockfileHash,
      cacheKey: cacheKey({
        sourceTreeHash,
        configHash: policy.configHash,
        policyHash: policy.policyHash,
        lockfileHash: policy.lockfileHash,
        mode,
        toolchain: tools,
      }),
      createdAt: new Date().toISOString(),
      toolchain: tools,
      registryHash: sha256(registrySource(policy)),
      sources,
      contexts: collector.contexts,
      notApplicable: [
        'service-worker',
        'ssr',
        'independent-entry',
        ...(sources.workers.length ? [] : ['worker']),
      ].map((context) => ({ context, reason: '本项目未启用；源码规则拒绝未经适配的加载方式。' })),
      files,
      siteHash: siteHash(files),
      checks: {
        forbiddenSources: 0,
        unknownSources: 0,
        fileDifferences: 0,
        sourceBoundaries: 'passed',
        buildGraphs: 'passed',
        finalFiles: 'passed',
      },
    };
    saveAudit(paths.audit, audit);
    auditBuild(root, enterpriseId, releaseId);
    console.log(
      JSON.stringify({
        enterpriseId,
        releaseId,
        files: files.length,
        siteHash: audit.siteHash,
        status: 'audited',
      }),
    );
    return audit;
  } catch (error) {
    writeFileSync(
      resolve(paths.audit, 'failed.json'),
      JSON.stringify({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
}

if (isMain(import.meta.url))
  await cli(async () => {
    const values = args(['enterprise', 'mode', 'release-id']);
    if (!values.enterprise || !values.mode)
      throw new Error('REQUIRED: --enterprise <id> --mode <development|staging|production>');
    await buildEnterprise(
      PROJECT_ROOT,
      values.enterprise,
      buildMode(values.mode),
      values['release-id'],
    );
  });
