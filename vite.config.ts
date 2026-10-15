import { defineConfig } from 'vite';
import {
  createEnterpriseConfig,
  createEnterpriseContext,
  prepareEnterpriseTarget,
} from './build/enterprise-config.ts';
import { acquireOutputLock, invalidateReleaseRecord } from './build/output-lock.ts';

export default defineConfig(({ command, mode }) => {
  const target = prepareEnterpriseTarget(mode);
  if (command === 'build') {
    // Acquire before Vite can empty output, share the same lease as coordinated builds.
    const release = acquireOutputLock(target);
    try {
      invalidateReleaseRecord(target.outDir);
      const config = createEnterpriseConfig(createEnterpriseContext(target), command);
      config.plugins = [
        ...(config.plugins ?? []),
        {
          name: 'enterprise-raw-build-lease',
          closeBundle() {
            release();
          },
        },
      ];
      return config;
    } catch (error) {
      release();
      throw error;
    }
  }
  return createEnterpriseConfig(createEnterpriseContext(target), command);
});
