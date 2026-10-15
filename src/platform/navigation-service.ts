import type { BuildProfile, ModuleId } from '../../shared/build-profile.ts';
import type { ModuleDefinition } from '../../shared/module-definition.ts';
import { getEntryRoute } from '../../shared/module-assembly.ts';
import { canViewModule, type UserAccess } from './permissions.ts';

export type ModuleLinkResolution =
  | { readonly available: true; readonly href: string }
  | {
      readonly available: false;
      readonly reason: 'disabled' | 'unauthenticated' | 'forbidden' | 'missing-entry';
      readonly message: string;
    };

/** Shared guard for model cards, shortcuts, search results, history and notifications. */
export function resolveModuleLink(
  moduleId: ModuleId,
  profile: BuildProfile,
  access: UserAccess,
  registry: readonly ModuleDefinition[],
): ModuleLinkResolution {
  if (profile.modules[moduleId] !== true) {
    return { available: false, reason: 'disabled', message: '当前企业版本未开放此体验模块。' };
  }
  if (!access.authenticated) {
    return { available: false, reason: 'unauthenticated', message: '请先登录后再进入此模块。' };
  }
  const module = registry.find((item) => item.id === moduleId);
  if (!module) {
    return { available: false, reason: 'missing-entry', message: '此模块入口暂不可用。' };
  }
  if (!canViewModule(module, access)) {
    return { available: false, reason: 'forbidden', message: '当前账号没有此模块的页面访问权限。' };
  }
  const entry = getEntryRoute(module);
  if (!entry || /[:*]/.test(entry.path)) {
    return { available: false, reason: 'missing-entry', message: '此模块入口暂不可用。' };
  }
  return { available: true, href: entry.path };
}

export function getModuleHref(
  moduleId: ModuleId,
  profile: BuildProfile,
  access: UserAccess,
  registry: readonly ModuleDefinition[],
): string | null {
  const link = resolveModuleLink(moduleId, profile, access, registry);
  return link.available ? link.href : null;
}

export function filterModuleLinks<T extends { readonly moduleId: ModuleId }>(
  items: readonly T[],
  profile: BuildProfile,
  access: UserAccess,
  registry: readonly ModuleDefinition[],
): T[] {
  return items.filter((item) => getModuleHref(item.moduleId, profile, access, registry) !== null);
}
