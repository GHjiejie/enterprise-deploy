import { join } from 'node:path';
import { lstatSync, readdirSync } from 'node:fs';
import type { BuildProfile } from '../shared/build-profile.ts';
import type { ReleaseMode } from '../shared/build-console.ts';
import { readConsoleFile, PACKAGE_LIMITS } from './console-package.ts';
import { verifyPruningArtifact, type PruningReport } from './pruning.ts';
import {
  canonicalJson,
  parseReleaseRecord,
  RELEASE_RECORD_FILE,
  scanArtifacts,
  type ReleaseRecordV2,
} from './release-record.ts';
import { assertRegularDirectory } from './console-store.ts';

interface ArtifactIdentity {
  readonly profile: BuildProfile;
  readonly mode: ReleaseMode;
  readonly jobId: string;
}

export interface VerifiedConsoleArtifact {
  readonly record: ReleaseRecordV2;
  readonly report: PruningReport;
}

export function verifyConsoleArtifact(
  directory: string,
  identity?: ArtifactIdentity,
): VerifiedConsoleArtifact {
  assertRegularDirectory(directory);
  let entries = 0;
  let bytes = 0;
  function checkLimits(path: string): void {
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      const stat = lstatSync(child);
      if (++entries > PACKAGE_LIMITS.entries || stat.isSymbolicLink())
        throw new Error('构建快照条目无效或超过数量限制');
      if (stat.isDirectory()) checkLimits(child);
      else if (stat.isFile()) {
        bytes += stat.size;
        if (stat.size > PACKAGE_LIMITS.fileBytes || bytes > PACKAGE_LIMITS.expandedBytes)
          throw new Error('构建快照大小超过交付包限制');
      } else throw new Error('构建快照禁止特殊文件');
    }
  }
  checkLimits(directory);
  const record = parseReleaseRecord(
    JSON.parse(
      readConsoleFile(join(directory, RELEASE_RECORD_FILE), PACKAGE_LIMITS.fileBytes).toString(
        'utf8',
      ),
    ),
  );
  if (record.schemaVersion !== 2) throw new Error('构建控制台仅接受经过物理裁剪验证的 V2 产物');
  if (
    identity &&
    (record.buildId !== identity.jobId ||
      record.environment !== identity.mode ||
      canonicalJson(record.profile) !== canonicalJson(identity.profile))
  )
    throw new Error('构建产物的企业配置或环境与当前任务不一致');
  if (
    canonicalJson(scanArtifacts(directory)) !==
    canonicalJson({ artifacts: record.artifacts, directories: record.directories })
  )
    throw new Error('构建产物完整性校验失败');
  const report = verifyPruningArtifact(directory, record);
  return { record, report };
}
