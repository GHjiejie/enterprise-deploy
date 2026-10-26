import type { ModuleSummary } from './contracts';

/** Presentation metadata stays in the local console and never enters a delivered app. */
export function capabilityLocation(id: string): { groupId: string; section: string } {
  if (id.startsWith('resource-'))
    return { groupId: 'external-resources', section: '共享 Mock 服务' };
  for (const page of ['access', 'account', 'billing', 'media', 'operations']) {
    if (id === page || id.startsWith(`${page}-`))
      return { groupId: page, section: id === page ? '基础能力' : '业务操作' };
  }
  const groupId =
    id === 'orders' || id.startsWith('order-')
      ? 'orders'
      : id === 'approvals' || id.startsWith('approval-')
        ? 'approvals'
        : id === 'inventory' || id.startsWith('inventory-')
          ? 'inventory'
          : id === 'stocktakes' || id.startsWith('stocktake-')
            ? 'stocktakes'
            : id;
  if (id === groupId) return { groupId, section: '基础能力' };
  if (id.includes('-column-')) return { groupId, section: '列表展示' };
  if (id.includes('-detail') || ['order-notes', 'approval-history'].includes(id))
    return { groupId, section: '详情与记录' };
  const flows: ReadonlyArray<readonly [string, string]> = [
    ['order-field-', '新建订单'],
    ['order-create', '新建订单'],
    ['approval-field-', '发起审批'],
    ['approval-submit', '发起审批'],
    ['approval-approve', '审批通过'],
    ['approval-reject', '审批驳回'],
    ['approval-review', '审批复核'],
    ['inventory-adjust', '库存调整'],
    ['inventory-transfer', '库存调拨'],
    ['stocktake-create', '创建盘点'],
    ['stocktake-count', '实盘录入'],
    ['stocktake-submit', '提交复核'],
    ['stocktake-approve', '复核通过'],
    ['stocktake-return', '退回重盘'],
    ['stocktake-post', '差异过账'],
    ['stocktake-cancel', '作废盘点'],
  ];
  return { groupId, section: flows.find(([prefix]) => id.startsWith(prefix))?.[1] ?? '业务操作' };
}

export function groupCapabilities(modules: readonly ModuleSummary[]) {
  const ids = [...new Set(modules.map((item) => item.groupId))];
  const order = [
    'orders',
    'inventory',
    'stocktakes',
    'approvals',
    'reports',
    'audit-log',
    'access',
    'account',
    'billing',
    'media',
    'operations',
    'company',
    'external-resources',
  ];
  return ids
    .sort((a, b) => {
      const left = order.indexOf(a);
      const right = order.indexOf(b);
      return (left < 0 ? order.length : left) - (right < 0 ? order.length : right);
    })
    .map((id) => {
      const base = modules.find((item) => item.id === id);
      return {
        id,
        title: base?.title ?? (id === 'external-resources' ? '外部资源（Mock）' : id),
        description:
          base?.description ??
          (id === 'external-resources'
            ? '共享模拟服务；关闭资源会同时移除依赖它的业务操作。'
            : '扩展业务模块'),
        capabilities: modules.filter((item) => item.groupId === id),
      };
    });
}

/** Only a reviewed bulk command uses closure. Individual toggles remain explicit. */
export function planSelection(
  modules: readonly ModuleSummary[],
  selected: readonly string[],
  requested: readonly string[],
  enabled: boolean,
): { added: string[]; removed: string[]; next: string[] } {
  const next = new Set(selected);
  const catalog = new Map(modules.map((item) => [item.id, item]));
  if (enabled) {
    const visiting = new Set<string>();
    function enable(id: string): void {
      if (visiting.has(id)) return;
      const module = catalog.get(id);
      if (!module) throw new Error(`未知能力：${id}`);
      visiting.add(id);
      next.add(id);
      for (const dependency of module.requires) enable(dependency);
    }
    for (const id of requested) enable(id);
  } else {
    const removed = new Set(requested);
    let changed = true;
    while (changed) {
      changed = false;
      for (const module of modules) {
        if (
          next.has(module.id) &&
          !removed.has(module.id) &&
          module.requires.some((id) => removed.has(id))
        ) {
          removed.add(module.id);
          changed = true;
        }
      }
    }
    for (const id of removed) next.delete(id);
  }
  return {
    added: [...next].filter((id) => !selected.includes(id)).sort(),
    removed: selected.filter((id) => !next.has(id)).sort(),
    next: [...next].sort(),
  };
}
