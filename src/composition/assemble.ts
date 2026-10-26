import { extensionSlots } from '../contracts/feature';
import type { ExtensionSlot } from '../contracts/feature';
import { formTargets } from '../contracts/presentation';
import type { DetailTab, FormField, TableColumn } from '../contracts/presentation';
import type { ModuleContext } from '../contracts/operations';
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
  const extensions: Record<ExtensionSlot, Owned<OrderTool>[]> = {
    shellTools: [],
    orderRows: [],
    inventoryTools: [],
    inventoryRows: [],
    approvalTools: [],
    approvalRows: [],
    stocktakeTools: [],
    stocktakeRows: [],
    stocktakeLines: [],
    accessTools: [],
    accountTools: [],
    billingTools: [],
    mediaTools: [],
    operationsTools: [],
    accessBrand: [],
    shellFooter: [],
    billingRows: [],
  };
  const formFields: Owned<FormField>[] = [];
  const columns: Owned<TableColumn>[] = [];
  const detailTabs: Owned<DetailTab>[] = [];
  const fieldKeys = new Set<string>();
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
      if (menu.guide && (!Number.isFinite(menu.guide.order) || !menu.guide.description.trim()))
        throw new Error(`INVALID_MENU_GUIDE: ${menu.id}`);
      menus.push(Object.freeze({ owner: module.id, value: menu }));
    }
    const declared = new Set((module.routes ?? []).map((route) => route.permission));
    for (const slot of ['orderTools', ...extensionSlots] as const) {
      for (const tool of module.contributions?.[slot] ?? []) {
        if (!tool.id || toolIds.has(tool.id) || !Number.isFinite(tool.order) || !tool.permission)
          throw new Error(`CONTRIBUTION_CONFLICT: ${tool.id}`);
        toolIds.add(tool.id);
        declared.add(tool.permission);
        const destination = slot === 'orderTools' ? orderTools : extensions[slot];
        destination.push(Object.freeze({ owner: module.id, value: tool }));
      }
    }
    function register<T extends { id: string; order: number; permission: string }>(
      item: T,
      destination: Owned<T>[],
    ): void {
      if (
        !/^[a-z][a-z0-9-]*$/u.test(item.id) ||
        toolIds.has(item.id) ||
        !Number.isFinite(item.order) ||
        !item.permission
      )
        throw new Error(`CONTRIBUTION_CONFLICT: ${item.id}`);
      toolIds.add(item.id);
      declared.add(item.permission);
      destination.push(Object.freeze({ owner: module.id, value: item }));
    }
    for (const field of module.contributions?.formFields ?? []) {
      const key = `${field.target}:${field.key}`;
      if (
        !formTargets.includes(field.target) ||
        !/^[a-z][a-zA-Z0-9]*$/u.test(field.key) ||
        ['constructor', 'prototype'].includes(field.key) ||
        fieldKeys.has(key)
      )
        throw new Error(`FORM_FIELD_CONFLICT: ${key}`);
      if (
        !field.label.trim() ||
        !['text', 'textarea', 'number', 'select'].includes(field.control) ||
        !['required', 'extension'].includes(field.purpose) ||
        typeof field.parse !== 'function' ||
        (field.control === 'number'
          ? typeof field.initial !== 'number'
          : typeof field.initial !== 'string') ||
        (field.control === 'select' &&
          !field.options?.length &&
          typeof field.optionsFor !== 'function') ||
        (field.purpose === 'required' && !field.required)
      )
        throw new Error(`INVALID_FORM_FIELD: ${field.id}`);
      fieldKeys.add(key);
      register(field, formFields);
    }
    for (const column of module.contributions?.columns ?? []) {
      if (
        !['orders', 'inventory', 'approvals', 'stocktakes'].includes(column.target) ||
        !column.title.trim() ||
        !column.component
      )
        throw new Error(`INVALID_COLUMN: ${column.id}`);
      register(column, columns);
    }
    for (const tab of module.contributions?.detailTabs ?? []) {
      if (
        !['order-detail', 'approval-detail', 'stocktake-detail'].includes(tab.target) ||
        !tab.title.trim() ||
        !tab.component
      )
        throw new Error(`INVALID_DETAIL_TAB: ${tab.id}`);
      register(tab, detailTabs);
    }
    for (const permission of declared) adminPermissions.add(`${module.id}:${permission}`);
    for (const permission of module.demoMemberPermissions ?? []) {
      if (!declared.has(permission))
        throw new Error(`DANGLING_PERMISSION: ${module.id}/${permission}`);
      memberPermissions.add(`${module.id}:${permission}`);
    }
  }
  // Field dependencies belong to a single form and must be present even before runtime permissions.
  const visitedFields = new Set<string>();
  const visitingFields = new Set<string>();
  function visitField(field: FormField): void {
    const id = `${field.target}:${field.key}`;
    if (visitingFields.has(id)) throw new Error(`FORM_FIELD_DEPENDENCY_CYCLE: ${id}`);
    if (visitedFields.has(id)) return;
    visitingFields.add(id);
    for (const key of field.dependsOn ?? []) {
      const dependency = formFields.find(
        (item) => item.value.target === field.target && item.value.key === key,
      );
      if (!dependency) throw new Error(`DANGLING_FORM_DEPENDENCY: ${id} -> ${key}`);
      visitField(dependency.value);
    }
    visitingFields.delete(id);
    visitedFields.add(id);
  }
  for (const field of formFields) visitField(field.value);
  for (const menu of menus) {
    const route = routes.find((item) => item.value.name === menu.value.routeName);
    if (!route || route.owner !== menu.owner || route.value.permission !== menu.value.permission)
      throw new Error(`DANGLING_MENU: ${menu.value.id}`);
  }
  for (const tool of [orderTools, ...Object.values(extensions)].flat()) {
    const guide = tool.value.guide;
    if (
      guide &&
      (!guide.title.trim() ||
        !guide.description.trim() ||
        !routes.some((item) => item.value.name === guide.routeName))
    )
      throw new Error(`INVALID_TOOL_GUIDE: ${tool.value.id}`);
  }
  for (const items of [orderTools, ...Object.values(extensions), formFields, columns, detailTabs]) {
    items.sort(
      (a, b) => a.value.order - b.value.order || a.value.id.localeCompare(b.value.id, 'en'),
    );
    Object.freeze(items);
  }
  return Object.freeze({
    routes: Object.freeze(routes),
    menus: Object.freeze(menus),
    orderTools: Object.freeze(orderTools),
    extensions: Object.freeze(extensions),
    formFields: Object.freeze(formFields),
    columns: Object.freeze(columns),
    detailTabs: Object.freeze(detailTabs),
    permissions: Object.freeze({
      admin: adminPermissions,
      member: memberPermissions,
      none: new Set<string>(),
    }),
  });
}

/** Activation is explicit and serial; failed activation unwinds all previously started modules. */
export async function activateModules(
  modules: readonly FeatureModule[],
  context: ModuleContext,
): Promise<() => void> {
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
      const cleanup = await module.activate?.(context);
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
