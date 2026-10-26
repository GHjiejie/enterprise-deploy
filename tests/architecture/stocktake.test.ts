import { describe, expect, it } from 'vitest';
import type { StockItem } from '../../src/contracts/operations';
import type { Stocktake } from '../../src/contracts/stocktake';
import { createStocktake } from '../../src/modules/stocktake-create/model';
import { countStocktake } from '../../src/modules/stocktake-count/model';
import { submitStocktake } from '../../src/modules/stocktake-submit/model';
import { approveStocktake } from '../../src/modules/stocktake-approve/model';
import { returnStocktake } from '../../src/modules/stocktake-return/model';
import { postStocktake } from '../../src/modules/stocktake-post/model';
import { cancelStocktake } from '../../src/modules/stocktake-cancel/model';
import { adjustStock } from '../../src/modules/inventory-adjust/model';
import { transferStock } from '../../src/modules/inventory-transfer/model';
import { parseForm } from '../../src/shared/form';
import { assembleModules } from '../../src/composition/assemble';
import quantity from '../../src/modules/stocktake-count-field-quantity';
import reason from '../../src/modules/stocktake-count-field-reason';
import note from '../../src/modules/stocktake-create-field-note';
import comment from '../../src/modules/stocktake-approve-field-comment';
import { loadPolicy, selectModules } from '../../build/policy/manifest';
import { PROJECT_ROOT } from '../../build/utils';
const stock: readonly StockItem[] = [
  { id: 's1', sku: 'A', name: '网关', warehouse: '上海', quantity: 10, reserved: 2, threshold: 5 },
  { id: 's2', sku: 'B', name: '面板', warehouse: '上海', quantity: 20, reserved: 5, threshold: 5 },
  { id: 't1', sku: 'A', name: '网关', warehouse: '杭州', quantity: 12, reserved: 2, threshold: 5 },
];
function ready(): Stocktake {
  let doc = createStocktake([], stock, '月末盘点', '上海');
  doc = countStocktake(doc, 's1', 9, '样品领用');
  doc = countStocktake(doc, 's2', 22, '到货漏记');
  return approveStocktake(submitStocktake(doc));
}
describe('stocktake workflow invariants', () => {
  it('freezes a warehouse snapshot and blocks overlapping active sheets while allowing other warehouses', () => {
    const doc = createStocktake([], stock, ' 月末盘点 ', '上海');
    expect(doc.title).toBe('月末盘点');
    expect(doc.lines.map((line) => line.bookQuantity)).toEqual([10, 20]);
    expect(doc.lines.every((line) => line.counted === null)).toBe(true);
    expect(() => createStocktake([doc], stock, '重复', '上海')).toThrow('未结束');
    expect(createStocktake([doc], stock, '另一仓', '杭州').lines).toHaveLength(1);
    expect(() => createStocktake([], stock, '无效', '北京')).toThrow('盘点仓库');
    expect(
      createStocktake([cancelStocktake(doc, '计划变更')], stock, '重新盘点', '上海'),
    ).toBeTruthy();
  });
  it('requires every line and a normalized difference reason, including zero actual stock', () => {
    const doc = createStocktake([], stock, '盘点', '上海');
    expect(() => submitStocktake(doc)).toThrow('全部明细');
    expect(() => countStocktake(doc, 's1', 9, '  ')).toThrow('差异原因');
    const zero = countStocktake(doc, 's1', 0, ' 全部损耗 ');
    expect(zero.lines[0]).toMatchObject({ counted: 0, reason: '全部损耗' });
    expect(() => countStocktake(doc, 's1', -1, '错误')).toThrow('不能小于');
    expect(() => countStocktake(doc, 's1', 0.5, '错误')).toThrow('整数');
    expect(() => countStocktake(doc, 's1', 1000001, '错误')).toThrow('整数');
    expect(() => countStocktake(doc, 'unknown', 10, '')).toThrow('失效');
  });
  it('posts all quantities exactly once without touching another warehouse or mutating the input', () => {
    const doc = ready();
    const before = JSON.stringify({ doc, stock });
    const result = postStocktake(doc, stock);
    expect(result.items.map((item) => item.quantity)).toEqual([9, 22, 12]);
    expect(result.items.map((item) => item.revision ?? 0)).toEqual([1, 1, 0]);
    expect(result.document.status).toBe('已过账');
    expect(result.document.history.at(-1)?.comment).toContain('+1 件');
    expect(JSON.stringify({ doc, stock })).toBe(before);
    expect(() => postStocktake(result.document, result.items)).toThrow('只有复核通过');
    expect(() => cancelStocktake(result.document, '不能作废')).toThrow('已结束');
  });
  it('fails atomically when a later line falls below reserved stock', () => {
    const readyDoc = ready();
    const doc = {
      ...readyDoc,
      lines: readyDoc.lines.map((line) => (line.stockId === 's2' ? { ...line, counted: 1 } : line)),
    };
    const original = JSON.stringify({ stock, doc });
    expect(() => postStocktake(doc, stock)).toThrow('低于预留');
    expect(JSON.stringify({ stock, doc })).toBe(original);
  });
  it('rejects adjusted, transferred, missing and ABA stock, even if quantities return to their old values', () => {
    const doc = ready();
    const adjusted = adjustStock(stock, 's1', 1, '临时增加');
    const reverted = adjustStock(adjusted, 's1', -1, '恢复数量');
    const transferred = transferStock(stock, 's1', 't1', 1, '补货');
    const first = stock[0];
    if (!first) throw new Error('fixture');
    for (const items of [
      adjusted,
      reverted,
      transferred,
      stock.slice(1),
      [...stock, { ...first, id: 'new' }],
    ])
      expect(() => postStocktake(doc, items)).toThrow(/变化/u);
  });
  it('returns a review or approved sheet to a fresh snapshot and clears every count while retaining history', () => {
    const doc = ready();
    const changed = adjustStock(stock, 's1', 1, '补货');
    const next = returnStocktake(doc, changed, ' 库存变动 ');
    expect(next.status).toBe('盘点中');
    expect(next.lines[0]).toMatchObject({
      bookQuantity: 11,
      stockRevision: 1,
      counted: null,
      reason: '',
    });
    expect(next.history).toHaveLength(doc.history.length + 1);
    expect(() => submitStocktake(next)).toThrow('全部明细');
    expect(() => returnStocktake(doc, changed, ' ')).toThrow('重盘原因');
    expect(() => returnStocktake(next, changed, '再次重盘')).toThrow('只有');
  });
  it('rejects skipped transitions and mutations after submission', () => {
    const draft = createStocktake([], stock, '盘点', '上海');
    expect(() => approveStocktake(draft)).toThrow('待复核');
    expect(() => postStocktake(draft, stock)).toThrow('复核通过');
    const pending = submitStocktake(
      countStocktake(countStocktake(draft, 's1', 10, ''), 's2', 20, ''),
    );
    expect(() => countStocktake(pending, 's1', 8, '修改')).toThrow('只有盘点中');
    expect(() => submitStocktake(pending)).toThrow('只有盘点中');
    expect(() => cancelStocktake(pending, ' ')).toThrow('作废原因');
    expect(cancelStocktake(pending, '计划取消').status).toBe('已作废');
  });
});
describe('stocktake field and build configuration boundaries', () => {
  it('enforces conditional difference reasons with matching or changed actual quantities', () => {
    const doc = createStocktake([], stock, '盘点', '上海');
    const line = doc.lines[0];
    if (!line) throw new Error('fixture');
    const fields = assembleModules([quantity, reason]).formFields;
    const reasonField = reason.contributions.formFields[0];
    if (!reasonField) throw new Error('fixture');
    expect(
      parseForm(fields, { quantity: 10, reason: '' }, ['quantity', 'reason'], {
        stocktakeLine: line,
      }).values,
    ).toEqual({ quantity: 10, reason: '' });
    expect(
      reasonField.requiredWhen({
        values: { quantity: 10 },
        stocktakeLine: line,
      }),
    ).toBe(false);
    expect(
      reasonField.requiredWhen({
        values: { quantity: 0 },
        stocktakeLine: line,
      }),
    ).toBe(true);
    expect(() =>
      parseForm(fields, { quantity: 9, reason: ' ' }, ['quantity', 'reason'], {
        stocktakeLine: line,
      }),
    ).toThrow('差异原因');
    expect(() =>
      parseForm(fields.slice(0, 1), { quantity: 9, reason: '残留' }, ['quantity', 'reason'], {
        stocktakeLine: line,
      }),
    ).toThrow('必填字段不可用');
  });
  it('omits pruned optional field data and validates installed optional fields', () => {
    expect(parseForm([], { note: 'residual', comment: 'residual' }, []).values).toEqual({});
    for (const module of [note, comment]) {
      const field = module.contributions.formFields[0];
      if (!field) throw new Error('fixture');
      expect(() =>
        parseForm(assembleModules([module]).formFields, { [field.key]: 'x'.repeat(201) }, []),
      ).toThrow('200');
    }
    expect(ready().history.at(-1)?.comment).toBe('实盘结果已复核，等待差异过账');
  });
  it('requires operation fields and detail hosts without forcing optional comments or other actions', () => {
    const policy = loadPolicy(PROJECT_ROOT, 'enterprise-a');
    for (const id of [
      'stocktake-create-field-title',
      'stocktake-create-field-warehouse',
      'stocktake-count-field-quantity',
      'stocktake-count-field-reason',
      'stocktake-return-field-reason',
      'stocktake-cancel-field-reason',
      'stocktake-detail-lines',
    ])
      expect(() =>
        selectModules(policy.catalog, {
          ...policy.enterprise,
          enabledModules: policy.enterprise.enabledModules.filter((item) => item !== id),
        }),
      ).toThrow('MISSING_DEPENDENCY');
    expect(
      selectModules(policy.catalog, {
        ...policy.enterprise,
        enabledModules: ['inventory', 'stocktakes', 'stocktake-approve'],
      }).map((item) => item.id),
    ).toEqual(['inventory', 'stocktakes', 'stocktake-approve']);
  });
});
