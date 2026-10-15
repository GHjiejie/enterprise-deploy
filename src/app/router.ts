import { generatePath, matchPath } from 'react-router-dom';
import type { BuildProfile, ModuleId } from '../../shared/build-profile.ts';
import type { ModuleDefinition } from '../../shared/module-definition.ts';
import { getEnabledModules } from '../../shared/module-assembly.ts';
import { getModuleHref } from '../platform/navigation-service.ts';
import { canViewModule, type UserAccess } from '../platform/permissions.ts';

export type RouteResolution =
  | {
      readonly kind: 'page';
      readonly moduleId: ModuleId;
      readonly routeName: string;
      readonly params: Readonly<Record<string, string>>;
    }
  | { readonly kind: 'redirect'; readonly to: string }
  | { readonly kind: 'not-found' | 'unauthenticated' | 'forbidden' | 'no-access' };

function checkAccess(module: ModuleDefinition, access: UserAccess): RouteResolution | null {
  if (!access.authenticated) return { kind: 'unauthenticated' };
  if (!canViewModule(module, access)) return { kind: 'forbidden' };
  return null;
}

function getParams(params: Record<string, string | undefined>): Record<string, string> | null {
  try {
    return Object.fromEntries(
      Object.entries(params)
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
        .map(([name, value]) => [name, decodeURIComponent(value)]),
    );
  } catch {
    return null;
  }
}

/** Resolve before importing a page, calling its loader or initiating module requests. */
export function resolveAppRoute(
  path: string,
  profile: BuildProfile,
  access: UserAccess,
  registry: readonly ModuleDefinition[],
): RouteResolution {
  const pathname = path.split(/[?#]/, 1)[0] ?? '';
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return { kind: 'not-found' };
  const modules = getEnabledModules(profile, registry);

  if (pathname === '/') {
    if (!access.authenticated) return { kind: 'unauthenticated' };
    const defaultHref = getModuleHref(profile.defaultModule, profile, access, registry);
    if (defaultHref) return { kind: 'redirect', to: defaultHref };
    for (const module of modules) {
      const href = getModuleHref(module.id, profile, access, registry);
      if (href) return { kind: 'redirect', to: href };
    }
    return { kind: 'no-access' };
  }

  for (const module of modules) {
    for (const route of module.routes) {
      const match = matchPath({ path: route.path, end: true, caseSensitive: true }, pathname);
      if (match) {
        const params = getParams(match.params);
        if (!params) return { kind: 'not-found' };
        return (
          checkAccess(module, access) ?? {
            kind: 'page',
            moduleId: module.id,
            routeName: route.name,
            params,
          }
        );
      }
      for (const alias of route.aliases ?? []) {
        const aliasMatch = matchPath({ path: alias, end: true, caseSensitive: true }, pathname);
        if (aliasMatch) {
          const params = getParams(aliasMatch.params);
          if (!params) return { kind: 'not-found' };
          return (
            checkAccess(module, access) ?? {
              kind: 'redirect',
              to: generatePath(route.path, params),
            }
          );
        }
      }
    }
  }

  // A legacy generic route must resolve its module before loading any business code.
  const legacy = matchPath({ path: '/playground/:type', end: true, caseSensitive: true }, pathname);
  const legacyModules: Readonly<Record<string, ModuleId>> = {
    chat: 'chat',
    image: 'imageStudio',
    video: 'videoStudio',
  };
  const type = legacy?.params.type;
  const moduleId = type ? legacyModules[type] : undefined;
  const module = moduleId ? modules.find((item) => item.id === moduleId) : undefined;
  if (module) {
    const rejection = checkAccess(module, access);
    if (rejection) return rejection;
    const href = getModuleHref(module.id, profile, access, registry);
    if (href) return { kind: 'redirect', to: href };
  }
  return { kind: 'not-found' };
}
