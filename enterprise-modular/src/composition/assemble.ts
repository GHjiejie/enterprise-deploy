import type { FeatureModule, FeatureRoute, MenuItem, OrderTool, Owned } from '../contracts/feature';

export function assembleModules(modules: readonly FeatureModule[]) {
  const moduleIds = new Set<string>();
  const names = new Set(['home', 'not-found']);
  const paths = new Set(['/']);
  const menuIds = new Set<string>();
  const toolIds = new Set<string>();
  const routes: Owned<FeatureRoute>[] = [];
  const menus: Owned<MenuItem>[] = [];
  const orderTools: Owned<OrderTool>[] = [];
  const adminPermissions = new Set<string>();
  const memberPermissions = new Set<string>();
  for (const module of modules) {
    if (!module.id || moduleIds.has(module.id)) throw new Error(`DUPLICATE_MODULE: ${module.id}`);
    moduleIds.add(module.id);
    for (const route of module.routes ?? []) {
      if (
        !route.name ||
        !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/u.test(route.path) ||
        names.has(route.name) ||
        paths.has(route.path)
      )
        throw new Error(`ROUTE_CONFLICT: ${route.name}/${route.path}`);
      if (!route.permission) throw new Error(`MISSING_PERMISSION: ${route.name}`);
      names.add(route.name);
      paths.add(route.path);
      routes.push(Object.freeze({ owner: module.id, value: route }));
    }
    for (const menu of module.menus ?? []) {
      if (!menu.id || menuIds.has(menu.id)) throw new Error(`MENU_CONFLICT: ${menu.id}`);
      menuIds.add(menu.id);
      menus.push(Object.freeze({ owner: module.id, value: menu }));
    }
    for (const tool of module.contributions?.orderTools ?? []) {
      if (!tool.id || toolIds.has(tool.id) || !Number.isFinite(tool.order) || !tool.permission)
        throw new Error(`CONTRIBUTION_CONFLICT: ${tool.id}`);
      toolIds.add(tool.id);
      orderTools.push(Object.freeze({ owner: module.id, value: tool }));
    }
    const declared = new Set([
      ...(module.routes ?? []).map((route) => route.permission),
      ...(module.contributions?.orderTools ?? []).map((tool) => tool.permission),
    ]);
    for (const permission of declared) adminPermissions.add(`${module.id}:${permission}`);
    for (const permission of module.demoMemberPermissions ?? []) {
      if (!declared.has(permission))
        throw new Error(`DANGLING_PERMISSION: ${module.id}/${permission}`);
      memberPermissions.add(`${module.id}:${permission}`);
    }
  }
  for (const menu of menus) {
    const route = routes.find((item) => item.value.name === menu.value.routeName);
    if (!route || route.owner !== menu.owner || route.value.permission !== menu.value.permission)
      throw new Error(`DANGLING_MENU: ${menu.value.id}`);
  }
  orderTools.sort(
    (a, b) => a.value.order - b.value.order || a.value.id.localeCompare(b.value.id, 'en'),
  );
  return Object.freeze({
    routes: Object.freeze(routes),
    menus: Object.freeze(menus),
    orderTools: Object.freeze(orderTools),
    permissions: Object.freeze({
      admin: adminPermissions,
      member: memberPermissions,
      none: new Set<string>(),
    }),
  });
}

/** Activation is explicit and serial; failed activation unwinds all previously started modules. */
export async function activateModules(modules: readonly FeatureModule[]): Promise<() => void> {
  const disposers: (() => void)[] = [];
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    const errors: unknown[] = [];
    for (const cleanup of disposers.reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'MODULE_DISPOSE_FAILED');
  };
  try {
    for (const module of modules) {
      const cleanup = await module.activate?.();
      if (cleanup) disposers.push(cleanup);
    }
  } catch (error) {
    try {
      dispose();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'MODULE_ACTIVATION_FAILED');
    }
    throw error;
  }
  return dispose;
}
