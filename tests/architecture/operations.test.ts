import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import type { StockItem } from '../../src/contracts/operations';
import { createActivityBus } from '../../src/core/activity';
import { createOrder } from '../../src/modules/order-create/model';
import { completeOrders } from '../../src/modules/order-bulk-complete/model';
import { adjustStock } from '../../src/modules/inventory-adjust/model';
import { transferStock } from '../../src/modules/inventory-transfer/model';
import { submitApproval } from '../../src/modules/approval-submit/model';
import { approveApproval } from '../../src/modules/approval-approve/model';
import { rejectApproval } from '../../src/modules/approval-reject/model';
import { reviewApproval } from '../../src/modules/approval-review/model';
import { prepareExport } from '../../src/modules/order-export/api';
import { assembleModules } from '../../src/composition/assemble';
import { loadPolicy, selectModules } from '../../build/policy/manifest';
import { PROJECT_ROOT } from '../../build/utils';

const stock: readonly StockItem[] = [
  { id: 's', sku: 'A', name: '商品 A', warehouse: '上海', quantity: 10, reserved: 3, threshold: 5 },
  { id: 't', sku: 'A', name: '商品 A', warehouse: '杭州', quantity: 2, reserved: 0, threshold: 5 },
  { id: 'x', sku: 'B', name: '商品 B', warehouse: '杭州', quantity: 5, reserved: 0, threshold: 5 },
];
describe('order operations', () => {
  it('validates and normalizes creation, including precision and non-finite amounts', () => {
    expect(createOrder(' 客户 ', 1.25)).toMatchObject({
      customer: '客户',
      amount: 1.25,
      status: '待处理',
    });
    for (const amount of [0, -1, NaN, Infinity, 0.001, 100000001])
      expect(() => createOrder('客户', amount)).toThrow('金额');
    expect(() => createOrder(' ', 1)).toThrow('客户名称');
  });
  it('completes a batch atomically and rejects mixed, missing and duplicate submissions', () => {
    const a = createOrder('甲', 1);
    const b = { ...createOrder('乙', 2), status: '已完成' as const };
    const rows = [a, b];
    expect(() => completeOrders(rows, [a.id, b.id])).toThrow('已完成');
    expect(() => completeOrders(rows, [a.id, 'missing'])).toThrow('已失效');
    expect(rows[0]?.status).toBe('待处理');
    const result = completeOrders(rows, [a.id]);
    expect(result.every((item) => item.status === '已完成')).toBe(true);
    expect(() => completeOrders(result, [a.id])).toThrow();
    expect(() => completeOrders(rows, [])).toThrow('至少');
  });
  it('exports orders with reactive detail notes using a cloneable, minimal worker payload', async () => {
    const order = reactive({
      ...createOrder('客户', 1),
      notes: [{ id: 'n', text: '内部备注', time: 'now' }],
    });
    const payload = await prepareExport([order], new AbortController().signal);
    expect(() => structuredClone(payload)).not.toThrow();
    expect(payload[0]).not.toHaveProperty('notes');
  });
});
describe('inventory invariants', () => {
  it('preserves reservations on adjustments and never mutates inputs', () => {
    const result = adjustStock(stock, 's', -7, '盘点');
    expect(result[0]?.quantity).toBe(3);
    expect(stock[0]?.quantity).toBe(10);
    expect(() => adjustStock(stock, 's', -8, '盘点')).toThrow('预留');
    for (const delta of [0, 0.5, Infinity])
      expect(() => adjustStock(stock, 's', delta, '盘点')).toThrow();
    expect(() => adjustStock(stock, 's', 1, ' ')).toThrow('原因');
  });
  it('transfers in one immutable transaction, conserving total stock', () => {
    const result = transferStock(stock, 's', 't', 7, '补货');
    expect(result.map((item) => item.quantity)).toEqual([3, 9, 5]);
    expect(result.reduce((sum, item) => sum + item.quantity, 0)).toBe(
      stock.reduce((sum, item) => sum + item.quantity, 0),
    );
    expect(stock.map((item) => item.quantity)).toEqual([10, 2, 5]);
    expect(() => transferStock(result, 's', 't', 1, '补货')).toThrow('可用库存');
  });
  it.each([
    ['s', 's', 1],
    ['s', 'x', 1],
    ['s', 'missing', 1],
    ['s', 't', 8],
    ['s', 't', 0],
    ['s', 't', 1.1],
  ] as const)('rejects invalid transfer %s → %s (%s)', (from, to, quantity) => {
    expect(() => transferStock(stock, from, to, quantity, '调拨')).toThrow();
    expect(stock[0]?.quantity).toBe(10);
  });
});
describe('approval state machine', () => {
  it('uses the exact threshold and records each stage without altering the prior snapshot', () => {
    const small = submitApproval('采购', '申请人', 49999.99);
    expect(approveApproval(small, '').status).toBe('已通过');
    const large = submitApproval('采购', '申请人', 50000);
    const review = approveApproval(large, '预算确认');
    expect(review.status).toBe('复核中');
    expect(large.status).toBe('待审批');
    const final = reviewApproval(review, '复核确认');
    expect(final.status).toBe('已通过');
    expect(final.history.map((item) => item.action)).toEqual(['提交申请', '初审通过', '复核通过']);
    expect(() => approveApproval(final, '')).toThrow('当前阶段');
  });
  it('requires a rejection reason at either stage and keeps terminal requests immutable', () => {
    const request = submitApproval('采购', '申请人', 70000);
    expect(() => rejectApproval(request, ' ')).toThrow('驳回原因');
    for (const current of [request, approveApproval(request, '')]) {
      const rejected = rejectApproval(current, '预算不足');
      expect(rejected.status).toBe('已驳回');
      expect(rejected.history.at(-1)?.comment).toBe('预算不足');
      expect(() => approveApproval(rejected, '')).toThrow();
    }
    expect(() => submitApproval(' ', '申请人', 1)).toThrow('申请事由');
    expect(() => submitApproval('采购', ' ', 1)).toThrow('申请人');
  });
});
describe('granular composition', () => {
  it.each([
    ['order-notes'],
    ['orders', 'order-notes'],
    ['order-detail', 'order-notes'],
    ['inventory-transfer'],
    ['approval-review'],
    ['approval-submit'],
    ['orders', 'order-create', 'order-field-customer'],
    ['approval-history'],
  ])('rejects missing dependency closure %j', (...enabledModules) => {
    const policy = loadPolicy(PROJECT_ROOT, 'enterprise-a');
    expect(() => selectModules(policy.catalog, { ...policy.enterprise, enabledModules })).toThrow(
      'MISSING_DEPENDENCY',
    );
  });
  it('sorts slots, intersects member permissions and rejects duplicate contribution IDs across slots', () => {
    const tool = { id: 'one', permission: 'edit', component: {}, order: 10 };
    const assembly = assembleModules([
      {
        id: 'feature',
        contributions: {
          orderRows: [tool],
          detailTabs: [
            { ...tool, id: 'two', permission: 'read', target: 'order-detail', title: '详情' },
          ],
        },
        demoMemberPermissions: ['read'],
      },
    ]);
    expect(assembly.extensions.orderRows[0]?.owner).toBe('feature');
    expect(assembly.permissions.member.has('feature:edit')).toBe(false);
    expect(assembly.permissions.member.has('feature:read')).toBe(true);
    expect(() =>
      assembleModules([{ id: 'x', contributions: { orderRows: [tool], inventoryTools: [tool] } }]),
    ).toThrow('CONTRIBUTION_CONFLICT');
  });
  it('delivers immutable activity records and stops delivery after disposal', () => {
    const bus = createActivityBus(() => '管理员');
    const events: string[] = [];
    const dispose = bus.subscribe((event) => {
      expect(Object.isFrozen(event)).toBe(true);
      events.push(event.action);
    });
    bus.publish({ area: '测试', action: '保存', subject: '1', detail: '完成' });
    dispose();
    dispose();
    bus.publish({ area: '测试', action: '保存', subject: '2', detail: '完成' });
    expect(events).toEqual(['保存']);
  });
});
