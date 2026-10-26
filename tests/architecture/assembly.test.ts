import type { ModuleContext } from '../../src/contracts/operations';
import { createActivityBus } from '../../src/core/activity';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import type { FeatureModule, FeatureRoute } from '../../src/contracts/feature';
import { activateModules, assembleModules } from '../../src/composition/assemble';
import { permitted } from '../../src/core/runtime';
import { toCsv } from '../../src/modules/order-export/csv';

const moduleContext: ModuleContext = {
  activity: createActivityBus(() => 'test'),
  provide: () => {},
};

const route: FeatureRoute = {
  name: 'orders',
  path: '/orders',
  permission: 'order.read',
  load: async () => ({ default: {} }),
};
const orders: FeatureModule = {
  id: 'orders',
  routes: [route],
  menus: [{ id: 'orders-menu', routeName: 'orders', title: '订单', permission: 'order.read' }],
};

describe('runtime assembly', () => {
  it('leaves optional contributions empty and sorts enabled tools stably', () => {
    expect(assembleModules([orders]).orderTools).toEqual([]);
    const module: FeatureModule = {
      id: 'export',
      contributions: {
        orderTools: ['z', 'a', 'first'].map((id) => ({
          id,
          order: id === 'first' ? 1 : 10,
          permission: 'order.export',
          component: {},
        })),
      },
    };
    expect(assembleModules([orders, module]).orderTools.map((item) => item.value.id)).toEqual([
      'first',
      'a',
      'z',
    ]);
  });

  it('rejects module, route, menu and contribution conflicts and dangling menus', () => {
    expect(() => assembleModules([orders, orders])).toThrow('DUPLICATE_MODULE');
    expect(() => assembleModules([orders, { id: 'other', routes: [route] }])).toThrow(
      'ROUTE_CONFLICT',
    );
    expect(() =>
      assembleModules([orders, { id: 'other', routes: [{ ...route, name: 'different' }] }]),
    ).toThrow('ROUTE_CONFLICT');
    expect(() =>
      assembleModules([{ id: 'other', routes: [{ ...route, path: '/orders/' }] }]),
    ).toThrow('ROUTE_CONFLICT');
    expect(() =>
      assembleModules([
        { id: 'x', menus: [{ id: 'bad', routeName: 'missing', title: 'bad', permission: 'x' }] },
      ]),
    ).toThrow('DANGLING_MENU');
    expect(() => assembleModules([orders, { id: 'x', menus: orders.menus ?? [] }])).toThrow(
      'MENU_CONFLICT',
    );
    const tool = { id: 'duplicate', order: 1, permission: 'order.export', component: {} };
    expect(() =>
      assembleModules([{ id: 'x', contributions: { orderTools: [tool, tool] } }]),
    ).toThrow('CONTRIBUTION_CONFLICT');
  });

  it('requires both service license and user permission for a delivered feature', () => {
    const access = {
      persona: ref<'admin' | 'member' | 'none'>('admin'),
      licensedModules: ref<ReadonlySet<string>>(new Set(['orders'])),
      permissions: {
        admin: new Set(['orders:order.read', 'reports:report.read']),
        member: new Set(['orders:order.read']),
        none: new Set<string>(),
      },
    };
    expect(permitted(access, 'orders', 'order.read')).toBe(true);
    expect(permitted(access, 'reports', 'report.read')).toBe(false);
    access.persona.value = 'none';
    expect(permitted(access, 'orders', 'order.read')).toBe(false);
  });

  it('activates explicitly, unwinds in reverse order and remains idempotent', async () => {
    const calls: string[] = [];
    const modules = ['a', 'b'].map((id) => ({
      id,
      activate: () => {
        calls.push(`start:${id}`);
        return () => {
          calls.push(`stop:${id}`);
        };
      },
    }));
    const dispose = await activateModules(modules, moduleContext);
    expect(calls).toEqual(['start:a', 'start:b']);
    dispose();
    dispose();
    expect(calls).toEqual(['start:a', 'start:b', 'stop:b', 'stop:a']);
  });

  it('cleans earlier modules after failed activation and continues cleanup after a disposer fails', async () => {
    const calls: string[] = [];
    await expect(
      activateModules(
        [
          {
            id: 'a',
            activate: () => () => {
              calls.push('a');
            },
          },
          {
            id: 'b',
            activate: () => {
              throw new Error('failed');
            },
          },
        ],
        moduleContext,
      ),
    ).rejects.toThrow('failed');
    expect(calls).toEqual(['a']);
    const dispose = await activateModules(
      [
        {
          id: 'a',
          activate: () => () => {
            calls.push('again');
          },
        },
        {
          id: 'b',
          activate: () => () => {
            throw new Error('dispose');
          },
        },
      ],
      moduleContext,
    );
    expect(dispose).toThrow('MODULE_DISPOSE_FAILED');
    expect(calls).toEqual(['a', 'again']);
  });

  it('escapes CSV cells and guards spreadsheet formulas', () => {
    const csv = toCsv([
      { id: '1', customer: '=SUM(1,2)', amount: 0, status: '已完成' },
      { id: '2', customer: 'A"B', amount: 10, status: '待处理' },
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain(`"'=SUM(1,2)"`);
    expect(csv).toContain('"A""B"');
    expect(csv).toContain('"0"');
  });
});
