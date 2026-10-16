import { loadPolicy, enterpriseIds } from './policy/manifest.ts';
import { scanSources } from './policy/scan.ts';
import { cli, PROJECT_ROOT } from './utils.ts';

await cli(() => {
  for (const enterprise of enterpriseIds(PROJECT_ROOT)) {
    const policy = loadPolicy(PROJECT_ROOT, enterprise);
    const sources = scanSources(policy);
    console.log(
      `${enterprise}: ${policy.selected.map((item) => item.id).join(', ')}; ${sources.inputs.length} inputs; ${sources.workers.length} workers`,
    );
  }
});
