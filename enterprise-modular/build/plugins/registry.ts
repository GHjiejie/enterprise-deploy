import type { Plugin } from 'vite';
import { BRAND_ID, REGISTRY_ID } from '../policy/origin.ts';
import type { Policy } from '../policy/types.ts';

export function registrySource(policy: Policy): string {
  return [
    ...policy.selected.map((item, index) => `import m${index} from ${JSON.stringify(item.entry)};`),
    `export default [${policy.selected.map((_item, index) => `m${index}`).join(',')}];`,
  ].join('\n');
}

export function enterpriseRegistry(policy: Policy): Plugin {
  const source = registrySource(policy);
  return {
    name: 'enterprise-static-registry',
    resolveId(id) {
      if (id === 'virtual:enterprise-modules') return REGISTRY_ID;
      if (id === 'virtual:enterprise-brand') return BRAND_ID;
      return null;
    },
    load(id) {
      if (id === REGISTRY_ID) return source;
      if (id === BRAND_ID) return `import ${JSON.stringify(policy.brand.entry)};`;
      return null;
    },
  };
}
