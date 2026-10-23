import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { within } from '../utils.ts';
import type { Origin, Policy } from './types.ts';

export const REGISTRY_ID = '\0virtual:enterprise-modules';
export const BRAND_ID = '\0virtual:enterprise-brand';
const generators = new Map([
  [REGISTRY_ID, 'registry'],
  [BRAND_ID, 'branding'],
  ['\0vite/modulepreload-polyfill.js', 'vite'],
  ['\0vite/preload-helper.js', 'vite'],
  ['\0rolldown/runtime.js', 'rolldown'],
  ['\0plugin-vue:export-helper', 'vue-export-helper'],
]);

export function sourceFile(id: string, root: string): string {
  let name = id;
  if (name.startsWith('file:')) name = fileURLToPath(name);
  name = name.replace(/^\/@fs\//u, '/').split(/[?#]/u)[0] ?? '';
  if (!name || name.includes('\0')) throw new Error(`UNCLASSIFIED_SOURCE: ${id}`);
  const absolute = isAbsolute(name) ? name : resolve(root, name);
  if (!existsSync(absolute)) throw new Error(`UNCLASSIFIED_SOURCE: ${id}`);
  return realpathSync(absolute);
}

export function identify(policy: Policy, id: string): Origin {
  const generator = generators.get(id);
  if (generator)
    return { id: `virtual:${generator}`, kind: 'generated', owner: `generator:${generator}` };
  if (id.startsWith('\0') || /^(?:https?:|data:|node:|\/\/)/u.test(id))
    throw new Error(`UNCLASSIFIED_SOURCE: ${id}`);
  const file = sourceFile(id, policy.root);
  const name = relative(policy.root, file).replaceAll('\\', '/');
  for (const item of policy.catalog)
    if (item.ownedRoots.some((root) => within(root, file)))
      return { id: name, kind: 'business', owner: item.id };
  for (const brand of policy.brands)
    if (within(brand.ownedRoot, file)) return { id: name, kind: 'brand', owner: brand.id };
  for (const owner of ['composition', 'contracts', 'core', 'shared'])
    if (within(resolve(policy.root, 'src', owner), file))
      return { id: name, kind: 'common', owner };
  if (file === resolve(policy.root, 'index.html'))
    return { id: 'index.html', kind: 'common', owner: 'core' };
  for (const approved of policy.packageRoots)
    if (within(approved.root, file))
      return {
        id: `package:${approved.name}/${relative(approved.root, file).replaceAll('\\', '/')}`,
        kind: 'vendor',
        owner: `package:${approved.name}`,
      };
  throw new Error(`UNCLASSIFIED_SOURCE: ${name}`);
}

export function assertAllowed(policy: Policy, origin: Origin): void {
  if (origin.kind === 'business' && !policy.enterprise.enabledModules.includes(origin.owner))
    throw new Error(`FORBIDDEN_MODULE: ${origin.owner}: ${origin.id}`);
  if (origin.kind === 'brand' && origin.owner !== policy.brand.id)
    throw new Error(`FORBIDDEN_BRAND: ${origin.owner}`);
}

export function assertEdge(policy: Policy, from: Origin, to: Origin): void {
  assertAllowed(policy, from);
  assertAllowed(policy, to);
  if (to.kind === 'business' && from.owner !== to.owner && from.id !== 'virtual:registry')
    throw new Error(`PRIVATE_MODULE_IMPORT: ${from.id} -> ${to.id}`);
  if (to.kind === 'brand' && from.owner !== to.owner && from.id !== 'virtual:branding')
    throw new Error(`PRIVATE_BRAND_IMPORT: ${from.id} -> ${to.id}`);
  if (to.id === 'virtual:registry' && !(from.kind === 'common' && from.owner === 'composition'))
    throw new Error(`REGISTRY_OUTSIDE_COMPOSITION: ${from.id}`);
  if (
    to.kind === 'common' &&
    to.owner === 'composition' &&
    from.owner !== 'composition' &&
    from.id !== 'index.html'
  )
    throw new Error(`REVERSE_COMPOSITION_IMPORT: ${from.id} -> ${to.id}`);
}

export function originPath(policy: Policy, id: string): string {
  if (id.startsWith('package:')) {
    const approved = policy.packageRoots.find((item) => id.startsWith(`package:${item.name}/`));
    if (!approved) throw new Error(`UNAPPROVED_PACKAGE: ${id}`);
    const file = sourceFile(
      resolve(approved.root, id.slice(`package:${approved.name}/`.length)),
      policy.root,
    );
    if (!within(approved.root, file)) throw new Error(`PACKAGE_PATH_ESCAPE: ${id}`);
    return file;
  }
  if (id.startsWith('virtual:')) {
    const entry = [...generators].find(([_key, value]) => id === `virtual:${value}`);
    if (!entry) throw new Error(`UNCLASSIFIED_GENERATOR: ${id}`);
    return entry[0];
  }
  if (
    isAbsolute(id) ||
    id.includes('\\') ||
    id.split('/').some((part) => part === '..' || part === '.' || !part)
  )
    throw new Error(`UNSAFE_SOURCE_ID: ${id}`);
  const file = sourceFile(resolve(policy.root, id), policy.root);
  if (!within(policy.root, file)) throw new Error(`SOURCE_PATH_ESCAPE: ${id}`);
  return file;
}
