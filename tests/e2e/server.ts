import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fixture } from '../helpers/fixture';
import { resolve } from 'node:path';
import { buildEnterprise } from '../../build/enterprise';
import { packageBuild, verifyPackage } from '../../build/package';
import { buildPaths } from '../../build/audit/record';
import { staticServer } from '../../build/preview';
import { args, cli, PROJECT_ROOT } from '../../build/utils';

await cli(async () => {
  const options = args(['enterprise', 'port']);
  if (!options.enterprise || !options.port) throw new Error('test server parameters');
  const project = ['enterprise-slim', 'enterprise-review'].includes(options.enterprise)
    ? fixture()
    : undefined;
  const root = project?.root ?? PROJECT_ROOT;
  if (project && options.enterprise === 'enterprise-slim')
    writeFileSync(
      resolve(root, 'config/enterprises/enterprise-slim.json'),
      JSON.stringify({
        schemaVersion: 1,
        enterpriseId: 'enterprise-slim',
        brandingId: 'brand-b',
        enabledModules: [
          'orders',
          'onboarding',
          'order-create',
          'order-field-customer',
          'order-field-amount',
          'order-column-customer',
          'order-detail',
          'order-detail-overview',
          'approvals',
          'approval-submit',
          'approval-field-title',
          'approval-field-applicant',
          'approval-field-amount',
          'approval-approve',
          'approval-column-title',
          'approval-column-status',
          'approval-detail',
          'approval-detail-overview',
          'inventory',
          'stocktakes',
          'stocktake-create',
          'stocktake-create-field-title',
          'stocktake-create-field-warehouse',
          'stocktake-detail',
          'stocktake-detail-lines',
          'stocktake-detail-history',
          'stocktake-count',
          'stocktake-count-field-quantity',
          'stocktake-count-field-reason',
          'stocktake-submit',
          'stocktake-approve',
          'stocktake-column-status',
        ],
      }),
    );
  if (project && options.enterprise === 'enterprise-review')
    writeFileSync(
      resolve(root, 'config/enterprises/enterprise-review.json'),
      JSON.stringify({
        schemaVersion: 1,
        enterpriseId: 'enterprise-review',
        brandingId: 'brand-b',
        enabledModules: [
          'approvals',
          'approval-review',
          'approval-column-title',
          'approval-column-status',
          'approval-detail',
          'approval-history',
        ],
      }),
    );
  const releaseId = `e2e-${randomUUID()}`;
  await buildEnterprise(root, options.enterprise, 'production', releaseId);
  packageBuild(root, options.enterprise, releaseId);
  const { audit } = verifyPackage(root, options.enterprise, releaseId);
  const server = staticServer(
    audit,
    resolve(buildPaths(root, options.enterprise, releaseId).release, 'site'),
  );
  if (project)
    for (const signal of ['SIGTERM', 'SIGINT'] as const)
      process.once(signal, () => {
        server.close();
        project.dispose();
        process.exit(0);
      });
  server.listen(Number(options.port), '127.0.0.1', () =>
    console.log(`sealed ${options.enterprise}: http://127.0.0.1:${options.port}`),
  );
});
