import { describe, expect, it } from 'vitest';
import { assembleModules } from '../../src/composition/assemble';
import type { FeatureModule, MenuItem, Owned, Runtime } from '../../src/contracts/feature';
import { collectGuideSteps } from '../../src/modules/onboarding/model';
import { placeGuide } from '../../src/shared/guide/position';
import orders from '../../src/modules/orders';
import inventory from '../../src/modules/inventory';
import approvals from '../../src/modules/approvals';
import stocktakes from '../../src/modules/stocktakes';
import reports from '../../src/modules/reports';
import audit from '../../src/modules/audit-log';
import create from '../../src/modules/order-create';
import exportOrders from '../../src/modules/order-export';
import complete from '../../src/modules/order-bulk-complete';
import transfer from '../../src/modules/inventory-transfer';
import submit from '../../src/modules/approval-submit';
import createStocktake from '../../src/modules/stocktake-create';
import onboarding from '../../src/modules/onboarding';
const modules = [
  orders,
  inventory,
  stocktakes,
  approvals,
  reports,
  audit,
  create,
  exportOrders,
  complete,
  transfer,
  submit,
  createStocktake,
  onboarding,
];
function stepsFor(
  installed: readonly FeatureModule[],
  persona: 'admin' | 'member',
  revoked: readonly string[] = [],
) {
  const assembly = assembleModules(installed);
  const licensed = new Set(
    installed.map((module) => module.id).filter((id) => !revoked.includes(id)),
  );
  const can: Runtime['can'] = (owner, permission) =>
    licensed.has(owner) && assembly.permissions[persona].has(`${owner}:${permission}`);
  return collectGuideSteps(
    assembly.menus,
    [...assembly.orderTools, ...Object.values(assembly.extensions).flat()],
    can,
  );
}
describe('permission-aware onboarding', () => {
  it('explains menu locations and then the delivered tools in a stable business order', () => {
    const steps = stepsFor(modules, 'admin');
    expect(steps.map((step) => step.target)).toEqual([
      'menu:orders-menu',
      'tool:order-create',
      'tool:order-bulk-complete',
      'tool:order-export-button',
      'menu:inventory-menu',
      'tool:inventory-transfer',
      'menu:stocktakes-menu',
      'tool:stocktake-create',
      'menu:approvals-menu',
      'tool:approval-submit',
      'menu:reports-menu',
      'menu:audit-log-menu',
    ]);
    expect(
      steps.every((step) => step.title && step.description && step.routeName && step.location),
    ).toBe(true);
    expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
  });
  it('includes only installed and authorized menu or button descriptions', () => {
    expect(stepsFor([orders, onboarding], 'admin').map((step) => step.title)).toEqual(['订单管理']);
    expect(stepsFor(modules, 'member').map((step) => step.target)).toEqual([
      'menu:orders-menu',
      'menu:inventory-menu',
      'menu:stocktakes-menu',
      'menu:approvals-menu',
      'tool:approval-submit',
    ]);
    const revoked = stepsFor(modules, 'admin', ['inventory', 'order-create']);
    expect(revoked.some((step) => step.target === 'tool:inventory-transfer')).toBe(false);
    expect(revoked.some((step) => step.target === 'tool:order-create')).toBe(false);
    expect(revoked.some((step) => step.target === 'menu:orders-menu')).toBe(true);
  });
  it('ignores menus without onboarding metadata and rejects invalid or dangling descriptions', () => {
    const menus: Owned<MenuItem>[] = [
      {
        owner: 'plain',
        value: { id: 'plain-menu', routeName: 'plain', title: '普通页面', permission: 'read' },
      },
    ];
    expect(collectGuideSteps(menus, [], () => true)).toEqual([]);
    expect(() =>
      assembleModules([
        {
          ...orders,
          menus: (orders.menus ?? []).map((menu) => ({
            ...menu,
            guide: { order: 1, description: ' ' },
          })),
        },
      ]),
    ).toThrow('INVALID_MENU_GUIDE');
    expect(() =>
      assembleModules([
        {
          id: 'bad',
          contributions: {
            shellTools: [
              {
                id: 'bad',
                order: 1,
                permission: 'read',
                component: {},
                guide: { routeName: 'missing', title: '悬空', description: '页面不存在' },
              },
            ],
          },
        },
      ]),
    ).toThrow('INVALID_TOOL_GUIDE');
  });
});
describe('spotlight positioning', () => {
  it('places a desktop popover beside the highlighted navigation without covering it', () => {
    const result = placeGuide(
      { left: 20, top: 200, width: 180, height: 44 },
      { width: 1440, height: 1000 },
      { width: 380, height: 310 },
    );
    expect(result.card.left).toBeGreaterThan(200);
    expect(result.card.top).toBe(200);
    expect(result.highlight).toEqual({ left: 14, top: 194, width: 192, height: 56 });
  });
  it('keeps popovers and highlights inside narrow or short viewports', () => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 390, height: 400 },
    ]) {
      const result = placeGuide(
        { left: 300, top: viewport.height - 75, width: 80, height: 44 },
        viewport,
        { width: 358, height: 300 },
      );
      expect(result.card.left).toBeGreaterThanOrEqual(16);
      expect(result.card.left + 358).toBeLessThanOrEqual(viewport.width - 16);
      expect(result.card.top).toBeGreaterThanOrEqual(16);
      expect(result.card.top + 300).toBeLessThanOrEqual(viewport.height - 16);
      expect(result.highlight.left + result.highlight.width).toBeLessThanOrEqual(viewport.width);
    }
  });
});
