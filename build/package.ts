import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { auditBuild, buildPaths } from './audit/record.ts';
import { verifyFiles } from './audit/files.ts';
import type { AuditRecord, PackageRecord } from './audit/types.ts';
import {
  args,
  canonical,
  cli,
  isMain,
  keys,
  PROJECT_ROOT,
  readJson,
  record,
  sha256,
} from './utils.ts';

export function parsePackage(
  value: unknown,
  audit: AuditRecord,
  auditBytes: Uint8Array,
): PackageRecord {
  const raw = record(value, 'package');
  keys(
    raw,
    [
      'schemaVersion',
      'enterpriseId',
      'releaseId',
      'auditHash',
      'siteHash',
      'packageHash',
      'packagedAt',
    ],
    'package',
  );
  if (
    raw.schemaVersion !== 1 ||
    raw.enterpriseId !== audit.enterpriseId ||
    raw.releaseId !== audit.releaseId ||
    raw.auditHash !== sha256(auditBytes) ||
    raw.siteHash !== audit.siteHash ||
    typeof raw.packageHash !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(raw.packageHash) ||
    typeof raw.packagedAt !== 'string'
  )
    throw new Error('PACKAGE_IDENTITY_MISMATCH');
  return {
    schemaVersion: 1,
    enterpriseId: audit.enterpriseId,
    releaseId: audit.releaseId,
    auditHash: raw.auditHash,
    siteHash: audit.siteHash,
    packageHash: raw.packageHash,
    packagedAt: raw.packagedAt,
  };
}

export function verifyPackage(
  root: string,
  enterpriseId: string,
  releaseId: string,
): { audit: AuditRecord; package: PackageRecord; archiveBytes: Buffer } {
  const paths = buildPaths(root, enterpriseId, releaseId);
  if (existsSync(resolve(paths.audit, 'package-failed.json'))) throw new Error('PACKAGE_FAILED');
  const audit = auditBuild(root, enterpriseId, releaseId, resolve(paths.release, 'site'));
  const packaged = parsePackage(
    readJson(resolve(paths.audit, 'package.json')),
    audit,
    readFileSync(resolve(paths.audit, 'audit.json')),
  );
  const archiveBytes = readFileSync(paths.archive);
  if (sha256(archiveBytes) !== packaged.packageHash) throw new Error('PACKAGE_HASH_MISMATCH');
  const entries = execFileSync('tar', ['-tzf', '-'], { input: archiveBytes, encoding: 'utf8' })
    .trim()
    .split('\n')
    .sort();
  if (canonical(entries) !== canonical(audit.files.map((item) => item.path).sort()))
    throw new Error('ARCHIVE_FILE_SET_MISMATCH');
  const verbose = execFileSync('tar', ['-tvzf', '-'], { input: archiveBytes, encoding: 'utf8' })
    .trim()
    .split('\n');
  if (verbose.some((line) => !line.startsWith('-'))) throw new Error('ARCHIVE_SPECIAL_ENTRY');
  for (const file of audit.files) {
    const bytes = execFileSync('tar', ['-xOzf', '-', '--', file.path], {
      input: archiveBytes,
      maxBuffer: Math.max(file.bytes + 1024, 1024 * 1024),
    });
    if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.sha256)
      throw new Error(`ARCHIVE_FILE_HASH_MISMATCH: ${file.path}`);
  }
  return { audit, package: packaged, archiveBytes };
}

export function packageBuild(root: string, enterpriseId: string, releaseId: string): PackageRecord {
  const audit = auditBuild(root, enterpriseId, releaseId);
  const paths = buildPaths(root, enterpriseId, releaseId);
  if (
    existsSync(paths.release) ||
    existsSync(paths.archive) ||
    existsSync(resolve(paths.audit, 'package.json'))
  )
    throw new Error('PACKAGE_ALREADY_EXISTS');
  mkdirSync(dirname(paths.release), { recursive: true });
  mkdirSync(paths.release);
  const site = resolve(paths.release, 'site');
  mkdirSync(site);
  try {
    for (const file of audit.files) {
      const target = resolve(site, file.path);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(resolve(paths.site, file.path), target);
    }
    verifyFiles(site, audit.files);
    mkdirSync(dirname(paths.archive), { recursive: true });
    execFileSync('tar', [
      '-czf',
      paths.archive,
      '-C',
      site,
      '--',
      ...audit.files.map((item) => item.path),
    ]);
    const result: PackageRecord = {
      schemaVersion: 1,
      enterpriseId,
      releaseId,
      auditHash: sha256(readFileSync(resolve(paths.audit, 'audit.json'))),
      siteHash: audit.siteHash,
      packageHash: sha256(readFileSync(paths.archive)),
      packagedAt: new Date().toISOString(),
    };
    writeFileSync(resolve(paths.audit, 'package.json'), `${JSON.stringify(result, null, 2)}\n`, {
      flag: 'wx',
    });
    verifyPackage(root, enterpriseId, releaseId);
    return result;
  } catch (error) {
    writeFileSync(
      resolve(paths.audit, 'package-failed.json'),
      JSON.stringify({ status: 'failed' }),
    );
    throw error;
  }
}

if (isMain(import.meta.url))
  await cli(() => {
    const values = args(['enterprise', 'release-id']);
    if (!values.enterprise || !values['release-id'])
      throw new Error('REQUIRED: --enterprise <id> --release-id <id>');
    console.log(
      JSON.stringify(packageBuild(PROJECT_ROOT, values.enterprise, values['release-id'])),
    );
  });
