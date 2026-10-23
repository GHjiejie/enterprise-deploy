import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import type { InlineConfig } from 'vite';
import type { Collector } from './audit/types.ts';
import type { BuildMode, Policy } from './policy/types.ts';
import { enterpriseGraphGuard } from './plugins/guard.ts';
import { enterpriseRegistry } from './plugins/registry.ts';

export function createEnterpriseConfig(
  policy: Policy,
  mode: BuildMode,
  releaseId: string,
  site: string,
  collector: Collector,
): InlineConfig {
  for (const name of ['.env.local', `.env.${mode}.local`])
    if (existsSync(resolve(policy.root, name))) throw new Error(`LOCAL_ENV_OVERRIDE: ${name}`);
  let workerIndex = 0;
  return {
    configFile: false,
    root: policy.root,
    mode,
    base: '/',
    envPrefix: 'PUBLIC_',
    publicDir: false,
    resolve: {
      alias: { '@': resolve(policy.root, 'src') },
      conditions: ['module', 'browser', mode === 'development' ? 'development' : 'production'],
    },
    plugins: [
      enterpriseRegistry(policy),
      enterpriseGraphGuard(policy, collector, 'app', 'app'),
      vue({ isProduction: mode !== 'development' }),
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
      'import.meta.env.PROD': JSON.stringify(mode !== 'development'),
      'import.meta.env.DEV': JSON.stringify(mode === 'development'),
      __BUILD_INFO__: JSON.stringify({
        enterpriseId: policy.enterprise.enterpriseId,
        brandName: policy.brand.name,
        modules: policy.selected.map((item) => item.id),
        mode,
        releaseId,
      }),
    },
    build: {
      outDir: site,
      emptyOutDir: true,
      sourcemap: false,
      assetsInlineLimit: 0,
      copyPublicDir: false,
      reportCompressedSize: false,
      target: 'es2022',
    },
    worker: {
      format: 'es',
      plugins: () => [enterpriseGraphGuard(policy, collector, `worker-${++workerIndex}`, 'worker')],
    },
    server: {
      host: '127.0.0.1',
      port: 5190,
      strictPort: true,
      fs: { strict: true, allow: [policy.root] },
    },
  };
}
