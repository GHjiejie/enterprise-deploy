import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { verifyPackage } from './package.ts';
import { buildPaths } from './audit/record.ts';
import { verifyFiles } from './audit/files.ts';
import {
  args,
  cli,
  identifier,
  isMain,
  keys,
  PROJECT_ROOT,
  readJson,
  record,
  strings,
} from './utils.ts';

export function publishRelease(root: string, targetValue: string, releaseId: string): string {
  const targetId = identifier(targetValue, 'target');
  const targets = record(readJson(resolve(root, 'config/delivery-targets.json')), 'targets');
  if (!Object.hasOwn(targets, targetId)) throw new Error('UNKNOWN_DELIVERY_TARGET');
  const target = record(targets[targetId], 'target');
  keys(target, ['enterpriseId', 'allowedModules', 'brandingId'], 'target');
  const enterpriseId = identifier(target.enterpriseId, 'enterpriseId');
  const approved = strings(target.allowedModules, 'target.allowedModules');
  const { audit, package: packaged, archiveBytes } = verifyPackage(root, enterpriseId, releaseId);
  if (
    audit.mode !== 'production' ||
    audit.brandingId !== target.brandingId ||
    audit.enabledModules.some((id) => !approved.includes(id))
  )
    throw new Error('TARGET_LICENSE_MISMATCH');
  const paths = buildPaths(root, enterpriseId, releaseId);
  const privateRoot = resolve(root, '.deploy', targetId);
  const publicRoot = resolve(root, 'deployments', targetId);
  mkdirSync(privateRoot, { recursive: true });
  mkdirSync(publicRoot, { recursive: true });
  const lockPath = resolve(privateRoot, 'publish.lock');
  const lock = openSync(lockPath, 'wx');
  try {
    const generation = resolve(privateRoot, `${releaseId}-${packaged.packageHash.slice(0, 12)}`);
    const site = resolve(generation, 'site');
    if (!existsSync(generation)) {
      const staging = resolve(privateRoot, `staging-${randomUUID()}`);
      mkdirSync(resolve(staging, 'site'), { recursive: true });
      execFileSync('tar', ['-xzf', '-', '-C', resolve(staging, 'site')], { input: archiveBytes });
      verifyFiles(resolve(staging, 'site'), audit.files);
      writeFileSync(
        resolve(staging, 'deployment.json'),
        JSON.stringify({
          enterpriseId,
          releaseId,
          packageHash: packaged.packageHash,
          siteHash: audit.siteHash,
        }),
      );
      renameSync(staging, generation);
    }
    verifyFiles(site, audit.files);
    const next = resolve(publicRoot, `next-${randomUUID()}`);
    symlinkSync(site, next, 'dir');
    renameSync(next, resolve(publicRoot, 'current'));
    writeFileSync(
      resolve(paths.audit, `published-${targetId}.json`),
      JSON.stringify({
        targetId,
        enterpriseId,
        releaseId,
        packageHash: packaged.packageHash,
        publishedAt: new Date().toISOString(),
      }),
    );
    return resolve(publicRoot, 'current');
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}

if (isMain(import.meta.url))
  await cli(() => {
    const values = args(['target', 'release-id']);
    if (!values.target || !values['release-id'])
      throw new Error('REQUIRED: --target <registered-target> --release-id <id>');
    console.log(
      JSON.stringify({
        status: 'published-local',
        current: publishRelease(PROJECT_ROOT, values.target, values['release-id']),
      }),
    );
  });
