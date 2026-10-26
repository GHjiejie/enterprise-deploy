import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { symlinkSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  buildMode,
  loadPolicy,
  parseEnterprise,
  selectModules,
  validateCatalog,
} from '../../build/policy/manifest';
import { identify } from '../../build/policy/origin';
import { scanSources } from '../../build/policy/scan';
import { registrySource } from '../../build/plugins/registry';
import { readJson } from '../../build/utils';
import { append, changeJson, fixture } from '../helpers/fixture';

let current: ReturnType<typeof fixture> | undefined;
afterEach(() => current?.dispose());
const setup = () => (current = fixture()).root;

describe('enterprise policy', () => {
  it('normalizes a copied selection and accepts an already validated frozen profile', () => {
    const selected = ['reports', 'orders'];
    const input = {
      schemaVersion: 1,
      enterpriseId: 'copy-test',
      enabledModules: selected,
      brandingId: 'brand-a',
    };
    const profile = parseEnterprise(input, 'copy-test');
    expect(selected).toEqual(['reports', 'orders']);
    expect(Object.isFrozen(selected)).toBe(false);
    expect(profile.enabledModules).toEqual(['orders', 'reports']);
    expect(Object.isFrozen(profile.enabledModules)).toBe(true);
    expect(profile.enabledModules).not.toBe(selected);
    expect(parseEnterprise(profile, 'copy-test')).toEqual(profile);
  });
  it('defaults to rejection and rejects unknown fields, duplicates and missing dependencies', () => {
    const root = setup();
    expect(() => loadPolicy(root, undefined)).toThrow('explicit enterprise required');
    expect(() => loadPolicy(root, '../enterprise-a')).toThrow('INVALID_IDENTIFIER');
    expect(() => loadPolicy(root, 'missing')).toThrow('UNKNOWN_ENTERPRISE');
    const policy = loadPolicy(root, 'enterprise-b');
    expect(() => parseEnterprise({ ...policy.enterprise, extra: true }, 'enterprise-b')).toThrow(
      'INVALID_FIELDS',
    );
    expect(() =>
      parseEnterprise({ ...policy.enterprise, schemaVersion: 2 }, 'enterprise-b'),
    ).toThrow('UNSUPPORTED_SCHEMA');
    expect(() =>
      parseEnterprise(
        { ...policy.enterprise, enabledModules: ['orders', 'orders'] },
        'enterprise-b',
      ),
    ).toThrow('DUPLICATE_ID');
    expect(() =>
      selectModules(policy.catalog, { ...policy.enterprise, enabledModules: ['order-export'] }),
    ).toThrow('MISSING_DEPENDENCY');
    expect(() =>
      selectModules(policy.catalog, { ...policy.enterprise, enabledModules: ['invented'] }),
    ).toThrow('UNKNOWN_MODULE');
    expect(() => buildMode('enterprise-a')).toThrow('INVALID_MODE');
  });

  it('orders dependencies deterministically and detects cycles, conflicts and overlapping ownership', () => {
    const root = setup();
    const policy = loadPolicy(root, 'enterprise-a');
    expect(policy.selected).toHaveLength(120);
    const ids = policy.selected.map((item) => item.id);
    for (const module of policy.selected)
      for (const dependency of module.requires)
        expect(ids.indexOf(dependency)).toBeLessThan(ids.indexOf(module.id));
    expect(() =>
      selectModules(
        policy.catalog.map((item) =>
          item.id === 'orders' ? { ...item, conflicts: ['reports'] } : item,
        ),
        policy.enterprise,
      ),
    ).toThrow('MODULE_CONFLICT');
    const raw = readJson(resolve(root, 'config/module-catalog.json')) as {
      modules: Record<string, unknown>[];
    };
    const first = raw.modules[0];
    if (!first) throw new Error('fixture');
    first.requires = ['order-export'];
    expect(() => validateCatalog(raw, root)).toThrow('DEPENDENCY_CYCLE');
    first.requires = [];
    raw.modules.push({ ...first, id: 'overlap' });
    expect(() => validateCatalog(raw, root)).toThrow('OVERLAPPING_OWNERS');
  });

  it('keeps B registry and source closure free of disabled business and other brands', () => {
    const root = setup();
    const policy = loadPolicy(root, 'enterprise-b');
    expect(registrySource(policy)).toContain('/orders/index.ts');
    expect(registrySource(policy)).not.toMatch(
      /reports|order-export|inventory|approval|audit-log|order-notes/u,
    );
    const evidence = scanSources(policy);
    expect(evidence.inputs.some((item) => item.owner === 'orders')).toBe(true);
    expect(
      evidence.inputs
        .filter((item) => item.kind === 'business')
        .every((item) => item.owner === 'orders'),
    ).toBe(true);
    expect(evidence.workers).toEqual([]);
    expect(
      evidence.inputs.filter((item) => item.kind === 'brand').map((item) => item.owner),
    ).toEqual(['brand-b']);
  });

  it('normalizes file URLs, query variants, path segments and symlinks to real owners', () => {
    const root = setup();
    const policy = loadPolicy(root, 'enterprise-b');
    const report = resolve(root, 'src/modules/reports/api.ts');
    expect(identify(policy, `${pathToFileURL(report).href}?raw`).owner).toBe('reports');
    expect(identify(policy, `${report}?vue&type=script`).owner).toBe('reports');
    symlinkSync(report, resolve(root, 'src/shared/innocent.ts'));
    expect(identify(policy, resolve(root, 'src/shared/innocent.ts')).owner).toBe('reports');
    writeFileSync(resolve(root, 'src/shared/reports-helper.ts'), 'export const safe = true;');
    expect(identify(policy, resolve(root, 'src/shared/reports-helper.ts')).kind).toBe('common');
    expect(() => identify(policy, '\0unknown-generator')).toThrow('UNCLASSIFIED_SOURCE');
    expect(() => identify(policy, resolve(root, 'package.json'))).toThrow('UNCLASSIFIED_SOURCE');
  });
});

describe('source boundary reverse cases', () => {
  it.each([
    ['direct', `import '@/modules/reports/api';`, 'FORBIDDEN_MODULE'],
    [
      'business registry',
      `import registry from 'virtual:enterprise-modules'; void registry;`,
      'REGISTRY_OUTSIDE_COMPOSITION',
    ],
    ['reverse composition', `import '../../composition/assemble';`, 'REVERSE_COMPOSITION_IMPORT'],
    ['re-export', `export * from '../reports/api';`, 'FORBIDDEN_MODULE'],
    ['dead dynamic import', `if (false) void import('../reports/api');`, 'FORBIDDEN_MODULE'],
    [
      'glob and filter',
      `const all = import.meta.glob('../*/index.ts'); void all;`,
      'FORBIDDEN_LOADER',
    ],
    ['computed import', `const path = './api'; void import(path);`, 'COMPUTED_IMPORT'],
    ['raw asset', `import text from '../reports/api.ts?raw'; void text;`, 'FORBIDDEN_MODULE'],
    ['wrong brand', `import '../../branding/brand-a/theme.css';`, 'FORBIDDEN_BRAND'],
    ['external script', `void import('https://example.invalid/report.js');`, 'EXTERNAL_SOURCE'],
    ['eval', `globalThis.eval('console.log(1)');`, 'FORBIDDEN_LOADER'],
    ['function generator', `new Function('return 1');`, 'FORBIDDEN_LOADER'],
    ['service worker', `navigator.serviceWorker.register('/sw.js');`, 'UNSUPPORTED_CONTEXT'],
    ['remote worker', `new Worker('https://example.invalid/a.js');`, 'UNTRACEABLE_WORKER'],
  ])('rejects %s before tree shaking', (_label, code, error) => {
    const root = setup();
    append(root, 'src/modules/orders/api.ts', code);
    expect(() => scanSources(loadPolicy(root, 'enterprise-b'))).toThrow(error);
  });

  it('rejects indirect barrel imports, shared reverse imports and private imports even in full A', () => {
    const root = setup();
    writeFileSync(resolve(root, 'src/shared/barrel.ts'), `export * from '../modules/reports/api';`);
    append(root, 'src/modules/orders/api.ts', `import '../../shared/barrel';`);
    expect(() => scanSources(loadPolicy(root, 'enterprise-b'))).toThrow('FORBIDDEN_MODULE');
    expect(() => scanSources(loadPolicy(root, 'enterprise-a'))).toThrow('PRIVATE_MODULE_IMPORT');
  });

  it('rejects a symlinked disabled implementation', () => {
    const root = setup();
    symlinkSync(resolve(root, 'src/modules/reports/api.ts'), resolve(root, 'src/shared/sneaky.ts'));
    append(root, 'src/modules/orders/api.ts', `import '../../shared/sneaky';`);
    expect(() => scanSources(loadPolicy(root, 'enterprise-b'))).toThrow('FORBIDDEN_MODULE');
  });

  it('checks CSS imports, URLs and escaped paths', () => {
    const root = setup();
    append(
      root,
      'src/modules/orders/orders.css',
      `.x { background: url('../reports/assets/revenue.svg'); }`,
    );
    expect(() => scanSources(loadPolicy(root, 'enterprise-b'))).toThrow('FORBIDDEN_MODULE');
    writeFileSync(
      resolve(root, 'src/modules/orders/orders.css'),
      '@import "../reports/reports.css";',
    );
    expect(() => scanSources(loadPolicy(root, 'enterprise-b'))).toThrow('FORBIDDEN_MODULE');
    writeFileSync(
      resolve(root, 'src/modules/orders/orders.css'),
      '.x { background: url("../rep\\6frts/assets/revenue.svg"); }',
    );
    expect(() => scanSources(loadPolicy(root, 'enterprise-b'))).toThrow('FORBIDDEN_MODULE');
  });

  it('checks optional worker inputs and rejects imports of disabled code in its closure', () => {
    const root = setup();
    changeJson(root, 'config/enterprises/enterprise-a.json', (value) => {
      value.enabledModules = ['orders', 'order-export'];
    });
    append(
      root,
      'src/modules/order-export/export.worker.ts',
      `if (false) void import('../reports/api');`,
    );
    expect(() => scanSources(loadPolicy(root, 'enterprise-a'))).toThrow('FORBIDDEN_MODULE');
  });

  it('treats owned workspace packages as business, not approved generic vendors', () => {
    const root = setup();
    symlinkSync(resolve(root, 'src/modules/reports'), resolve(root, 'src/shared/package-alias'));
    append(root, 'src/modules/orders/api.ts', `import '../../shared/package-alias/api';`);
    expect(() => scanSources(loadPolicy(root, 'enterprise-b'))).toThrow('FORBIDDEN_MODULE');
  });
});
