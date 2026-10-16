import { auditBuild } from './audit/record.ts';
import { args, cli, PROJECT_ROOT } from './utils.ts';

await cli(() => {
  const values = args(['enterprise', 'release-id']);
  if (!values.enterprise || !values['release-id'])
    throw new Error('REQUIRED: --enterprise <id> --release-id <id>');
  const audit = auditBuild(PROJECT_ROOT, values.enterprise, values['release-id']);
  console.log(
    JSON.stringify({
      status: 'passed',
      enterpriseId: audit.enterpriseId,
      releaseId: audit.releaseId,
      files: audit.files.length,
      siteHash: audit.siteHash,
    }),
  );
});
