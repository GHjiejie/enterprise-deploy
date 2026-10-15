import type { Plugin } from 'vite';
import { MODULE_IDS, type BuildProfile } from '../shared/build-profile.ts';
import { moduleEntries, validateModuleAssembly } from './module-catalog.ts';

export const ACTIVE_MODULE_ID = 'virtual:enterprise-modules';
export const RESOLVED_ACTIVE_MODULE_ID = `\0${ACTIVE_MODULE_ID}`;

export function generateActiveModuleSource(profile: BuildProfile): string {
  validateModuleAssembly(profile);
  const enabled = MODULE_IDS.filter((id) => profile.modules[id]);
  const imports = enabled.map(
    (id) =>
      `import { ${moduleEntries[id].metadataExport} as ${id} } from ${JSON.stringify(`/${moduleEntries[id].metadata}`)};`,
  );
  const loaders = enabled.map(
    (id) => `${JSON.stringify(id)}: () => import(${JSON.stringify(`/${moduleEntries[id].page}`)})`,
  );
  const activators = enabled.flatMap((id) =>
    moduleEntries[id].activator
      ? [
          `${JSON.stringify(id)}: () => import(${JSON.stringify(`/${moduleEntries[id].activator}`)})`,
        ]
      : [],
  );
  return [
    ...imports,
    `export const activeRegistry = [${enabled.join(',')}];`,
    `export const pageLoaders = {${loaders.join(',')}};`,
    `export const activatorLoaders = {${activators.join(',')}};`,
    `export const activeModuleIds = ${JSON.stringify(enabled)};`,
  ].join('\n');
}

export function activeModulesPlugin(profile: BuildProfile): Plugin {
  const source = generateActiveModuleSource(profile);
  return {
    name: 'enterprise-active-modules',
    resolveId(id) {
      if (id === ACTIVE_MODULE_ID) return RESOLVED_ACTIVE_MODULE_ID;
    },
    load(id) {
      if (id === RESOLVED_ACTIVE_MODULE_ID) return source;
    },
  };
}
