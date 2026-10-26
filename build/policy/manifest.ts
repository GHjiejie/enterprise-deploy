import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canonical,
  identifier,
  keys,
  policyCodeHash,
  readJson,
  record,
  sha256,
  strings,
  trustedPath,
  within,
} from '../utils.ts';
import type { Brand, BuildMode, Enterprise, ModuleSpec, Policy } from './types.ts';

export function parseEnterprise(value: unknown, expectedId: string): Enterprise {
  const raw = record(value, 'enterprise');
  keys(raw, ['schemaVersion', 'enterpriseId', 'enabledModules', 'brandingId'], 'enterprise');
  if (raw.schemaVersion !== 1) throw new Error('UNSUPPORTED_SCHEMA: enterprise');
  const enterpriseId = identifier(raw.enterpriseId, 'enterpriseId');
  if (enterpriseId !== expectedId) throw new Error('ENTERPRISE_ID_MISMATCH');
  const enabledModules = [...strings(raw.enabledModules, 'enabledModules')].sort();
  if (!enabledModules.length) throw new Error('EMPTY_MODULE_SELECTION');
  enabledModules.forEach((id) => identifier(id, 'module'));
  return Object.freeze({
    schemaVersion: 1,
    enterpriseId,
    enabledModules: Object.freeze(enabledModules),
    brandingId: identifier(raw.brandingId, 'brandingId'),
  });
}

export function validateCatalog(
  value: unknown,
  rootValue: string,
): { modules: ModuleSpec[]; packages: string[] } {
  const root = realpathSync(rootValue);
  const raw = record(value, 'catalog');
  keys(raw, ['schemaVersion', 'modules', 'approvedPackages'], 'catalog');
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.modules)) throw new Error('INVALID_CATALOG');
  const modules = raw.modules.map((item): ModuleSpec => {
    const data = record(item, 'module');
    keys(data, ['id', 'entry', 'requires', 'conflicts', 'ownedRoots'], 'module');
    const id = identifier(data.id, 'moduleId');
    if (typeof data.entry !== 'string') throw new Error('INVALID_ENTRY');
    const entry = trustedPath(root, data.entry);
    if (!statSync(entry).isFile()) throw new Error(`INVALID_ENTRY: ${id}`);
    const ownedRoots = strings(data.ownedRoots, 'ownedRoots').map((path) =>
      trustedPath(root, path),
    );
    if (!ownedRoots.length || !ownedRoots.some((path) => within(path, entry)))
      throw new Error(`UNOWNED_ENTRY: ${id}`);
    if (
      ownedRoots.some(
        (path) =>
          !statSync(path).isDirectory() ||
          within(path, resolve(root, 'src/core')) ||
          within(path, resolve(root, 'src/shared')),
      )
    )
      throw new Error(`INVALID_OWNER_ROOT: ${id}`);
    return Object.freeze({
      id,
      entry,
      requires: Object.freeze(strings(data.requires, 'requires')),
      conflicts: Object.freeze(strings(data.conflicts, 'conflicts')),
      ownedRoots: Object.freeze(ownedRoots),
    });
  });
  const ids = new Set(modules.map((item) => item.id));
  if (ids.size !== modules.length) throw new Error('DUPLICATE_MODULE');
  for (const item of modules) {
    for (const dependency of [...item.requires, ...item.conflicts])
      if (!ids.has(dependency) || dependency === item.id)
        throw new Error(`INVALID_DEPENDENCY: ${item.id} -> ${dependency}`);
    for (const other of modules) {
      if (other === item) continue;
      if (item.ownedRoots.some((a) => other.ownedRoots.some((b) => within(a, b) || within(b, a))))
        throw new Error(`OVERLAPPING_OWNERS: ${item.id}/${other.id}`);
    }
  }
  orderModules(modules); // Reject cycles even if the affected modules are currently disabled.
  return { modules, packages: strings(raw.approvedPackages, 'approvedPackages') };
}

export function orderModules(modules: readonly ModuleSpec[]): ModuleSpec[] {
  const lookup = new Map(modules.map((item) => [item.id, item]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: ModuleSpec[] = [];
  function visit(item: ModuleSpec): void {
    if (visiting.has(item.id)) throw new Error(`DEPENDENCY_CYCLE: ${item.id}`);
    if (visited.has(item.id)) return;
    visiting.add(item.id);
    for (const id of [...item.requires].sort()) {
      const dependency = lookup.get(id);
      if (!dependency) throw new Error(`MISSING_DEPENDENCY: ${item.id} -> ${id}`);
      visit(dependency);
    }
    visiting.delete(item.id);
    visited.add(item.id);
    ordered.push(item);
  }
  for (const item of [...modules].sort((a, b) => a.id.localeCompare(b.id, 'en'))) visit(item);
  return ordered;
}

export function selectModules(
  catalog: readonly ModuleSpec[],
  enterprise: Enterprise,
): ModuleSpec[] {
  const ids = new Set(enterprise.enabledModules);
  for (const id of ids)
    if (!catalog.some((item) => item.id === id)) throw new Error(`UNKNOWN_MODULE: ${id}`);
  const selected = catalog.filter((item) => ids.has(item.id));
  for (const item of selected) {
    for (const id of item.requires)
      if (!ids.has(id)) throw new Error(`MISSING_DEPENDENCY: ${item.id} -> ${id}`);
    for (const id of item.conflicts)
      if (ids.has(id)) throw new Error(`MODULE_CONFLICT: ${item.id}/${id}`);
  }
  return orderModules(selected);
}

export function buildMode(value: unknown): BuildMode {
  if (value !== 'development' && value !== 'staging' && value !== 'production')
    throw new Error('INVALID_MODE: development | staging | production');
  return value;
}

export function enterpriseIds(root: string): string[] {
  return readdirSync(resolve(root, 'config/enterprises'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => identifier(name.slice(0, -5), 'enterprise file'))
    .sort();
}

export function loadBrands(root: string): Brand[] {
  const brandData = record(readJson(resolve(root, 'config/brands.json')), 'brands');
  return Object.entries(brandData).map(([brandId, item]): Brand => {
    identifier(brandId, 'brand');
    const raw = record(item, 'brand');
    keys(raw, ['name', 'entry', 'ownedRoot'], 'brand');
    if (
      typeof raw.name !== 'string' ||
      typeof raw.entry !== 'string' ||
      typeof raw.ownedRoot !== 'string'
    )
      throw new Error('INVALID_BRAND');
    const entry = trustedPath(root, raw.entry);
    const ownedRoot = trustedPath(root, raw.ownedRoot);
    if (!within(ownedRoot, entry) || !within(resolve(root, 'src/branding', brandId), ownedRoot))
      throw new Error('INVALID_BRAND_PATH');
    return Object.freeze({ id: brandId, name: raw.name, entry, ownedRoot });
  });
}

export function loadPolicy(rootValue: string, enterpriseValue: unknown): Policy {
  const root = realpathSync(rootValue);
  const id = identifier(enterpriseValue, 'explicit enterprise required');
  if (!enterpriseIds(root).includes(id)) throw new Error(`UNKNOWN_ENTERPRISE: ${id}`);
  const enterprise = parseEnterprise(
    readJson(trustedPath(root, `config/enterprises/${id}.json`)),
    id,
  );
  const catalog = validateCatalog(readJson(resolve(root, 'config/module-catalog.json')), root);
  const brandData = record(readJson(resolve(root, 'config/brands.json')), 'brands');
  const brands = loadBrands(root);
  const brand = brands.find((item) => item.id === enterprise.brandingId);
  if (!brand) throw new Error('UNKNOWN_BRAND');
  const packageRoots = catalog.packages.flatMap((name) => {
    if (!/^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/u.test(name)) throw new Error('INVALID_APPROVED_PACKAGE');
    const directory = resolve(root, 'node_modules', name);
    if (!existsSync(directory)) return [];
    const metadata = record(readJson(resolve(directory, 'package.json')), name);
    if (metadata.name !== name) throw new Error(`PACKAGE_NAME_MISMATCH: ${name}`);
    return [Object.freeze({ name, root: realpathSync(directory) })];
  });
  return Object.freeze({
    root,
    enterprise,
    catalog: Object.freeze(catalog.modules),
    selected: Object.freeze(selectModules(catalog.modules, enterprise)),
    brands: Object.freeze(brands),
    brand,
    packageRoots: Object.freeze(packageRoots),
    configHash: sha256(canonical(enterprise)),
    policyHash: sha256(
      canonical({
        catalog: readJson(resolve(root, 'config/module-catalog.json')),
        brands: brandData,
        implementation: policyCodeHash(root),
      }),
    ),
    lockfileHash: sha256(readFileSync(resolve(root, 'package-lock.json'))),
  });
}
