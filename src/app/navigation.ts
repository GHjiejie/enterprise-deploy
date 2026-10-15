import type { BuildProfile, ModuleId } from '../../shared/build-profile.ts';
import type { ModuleDefinition } from '../../shared/module-definition.ts';
import { getEnabledModules, moduleRegistry } from './module-registry.ts';
import { getModuleHref } from '../platform/navigation-service.ts';
import type { UserAccess } from '../platform/permissions.ts';

export interface NavigationItem {
  readonly moduleId: ModuleId;
  readonly label: string;
  readonly href: string;
  readonly routeName: string;
}

export interface NavigationGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavigationItem[];
}

export function getNavigation(
  profile: BuildProfile,
  access: UserAccess,
  registry: readonly ModuleDefinition[] = moduleRegistry,
): NavigationGroup[] {
  const groups = new Map<string, NavigationItem[]>();
  const sortedModules = [...getEnabledModules(profile, registry)].sort(
    (left, right) => (left.navigation?.order ?? 0) - (right.navigation?.order ?? 0),
  );
  for (const module of sortedModules) {
    const navigation = module.navigation;
    const href = getModuleHref(module.id, profile, access, registry);
    if (!navigation || !href) continue;
    const items = groups.get(navigation.group) ?? [];
    items.push({
      moduleId: module.id,
      label: navigation.label,
      href,
      routeName: module.entryRouteName,
    });
    groups.set(navigation.group, items);
  }
  return Array.from(groups, ([label, items]) => ({ id: label, label, items }));
}
