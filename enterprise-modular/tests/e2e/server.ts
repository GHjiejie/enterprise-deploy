import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { buildEnterprise } from '../../build/enterprise';
import { packageBuild, verifyPackage } from '../../build/package';
import { buildPaths } from '../../build/audit/record';
import { staticServer } from '../../build/preview';
import { args, cli, PROJECT_ROOT } from '../../build/utils';

await cli(async () => {
  const options = args(['enterprise', 'port']);
  if (!options.enterprise || !options.port) throw new Error('test server parameters');
  const releaseId = `e2e-${randomUUID()}`;
  await buildEnterprise(PROJECT_ROOT, options.enterprise, 'production', releaseId);
  packageBuild(PROJECT_ROOT, options.enterprise, releaseId);
  const { audit } = verifyPackage(PROJECT_ROOT, options.enterprise, releaseId);
  const server = staticServer(
    audit,
    resolve(buildPaths(PROJECT_ROOT, options.enterprise, releaseId).release, 'site'),
  );
  server.listen(Number(options.port), '127.0.0.1', () =>
    console.log(`sealed ${options.enterprise}: http://127.0.0.1:${options.port}`),
  );
});
