import { resolve } from 'node:path';
import { buildEnterprise } from '../enterprise.ts';
import { packageBuild, verifyPackage } from '../package.ts';
import { args, cli, identifier, keys, PROJECT_ROOT, readJson, record } from '../utils.ts';
import { releaseMode } from './contracts.ts';
import type { BuildStage } from './contracts.ts';

await cli(async () => {
  const options = args(['request']);
  if (!options.request) throw new Error('Missing internal job request');
  const request = record(readJson(resolve(options.request)), 'jobRequest');
  keys(request, ['enterpriseId', 'releaseId', 'mode', 'source'], 'jobRequest');
  const source = record(request.source, 'source');
  keys(source, ['commit', 'dirty'], 'source');
  if (
    typeof source.commit !== 'string' ||
    !/^(?:unversioned|[a-f0-9]{40,64})$/u.test(source.commit) ||
    typeof source.dirty !== 'boolean'
  )
    throw new Error('Invalid source provenance');
  const enterprise = identifier(request.enterpriseId, 'enterprise');
  const id = identifier(request.releaseId, 'release');
  const mode = releaseMode(request.mode);
  const stage = (value: BuildStage): void => {
    console.log(`@@console-stage ${value}`);
  };
  await buildEnterprise(PROJECT_ROOT, enterprise, mode, id, {
    source: { commit: source.commit, dirty: source.dirty },
    onStage: stage,
  });
  stage('packaging');
  packageBuild(PROJECT_ROOT, enterprise, id);
  stage('verifying');
  const verified = verifyPackage(PROJECT_ROOT, enterprise, id);
  console.log(
    `归档内容复验通过：${verified.audit.files.length} 个文件；SHA-256 ${verified.package.packageHash}`,
  );
});
