import { defineConfig } from 'vite';
import { createEnterpriseConfig } from './build/config';
import { buildMode, loadPolicy } from './build/policy/manifest';
import { scanSources } from './build/policy/scan';
import { PROJECT_ROOT } from './build/utils';

export default defineConfig(({ command, mode }) => {
  if (command === 'build')
    throw new Error('USE_COORDINATED_BUILD: npm run build -- --enterprise <id> --mode production');
  const policy = loadPolicy(PROJECT_ROOT, process.env.APP_ENTERPRISE);
  scanSources(policy);
  return createEnterpriseConfig(policy, buildMode(mode), 'development', '.work/dev/site', {
    contexts: [],
  });
});
