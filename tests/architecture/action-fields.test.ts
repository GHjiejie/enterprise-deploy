import { describe, expect, it } from 'vitest';
import { createApp, effectScope, ref } from 'vue';
import type { FeatureModule, Runtime } from '../../src/contracts/feature';
import { runtimeKey } from '../../src/contracts/feature';
import type { StockItem } from '../../src/contracts/operations';
import type { FormField } from '../../src/contracts/presentation';
import { assembleModules } from '../../src/composition/assemble';
import { createActivityBus } from '../../src/core/activity';
import { permitted } from '../../src/core/runtime';
import { parseForm } from '../../src/shared/form';
import { useConfiguredForm } from '../../src/shared/useConfiguredForm';
import { loadPolicy, selectModules } from '../../build/policy/manifest';
import { PROJECT_ROOT } from '../../build/utils';
import adjustQuantity from '../../src/modules/inventory-adjust-field-quantity';
import adjustReason from '../../src/modules/inventory-adjust-field-reason';
import source from '../../src/modules/inventory-transfer-field-source';
import target from '../../src/modules/inventory-transfer-field-target';
import quantity from '../../src/modules/inventory-transfer-field-quantity';
import reason from '../../src/modules/inventory-transfer-field-reason';
import initialComment from '../../src/modules/approval-approve-field-comment';
import rejectionReason from '../../src/modules/approval-reject-field-reason';
import reviewComment from '../../src/modules/approval-review-field-comment';
import { approveApproval } from '../../src/modules/approval-approve/model';
import { reviewApproval } from '../../src/modules/approval-review/model';
import { submitApproval } from '../../src/modules/approval-submit/model';

const stock: readonly StockItem[] = [
  { id: 's', sku: 'A', name: '商品 A', warehouse: '上海', quantity: 10, reserved: 3, threshold: 5 },
  { id: 't', sku: 'A', name: '商品 A', warehouse: '杭州', quantity: 2, reserved: 0, threshold: 5 },
  { id: 'x', sku: 'B', name: '商品 B', warehouse: '杭州', quantity: 5, reserved: 0, threshold: 5 },
];
const transfer = [source, target, quantity, reason];
const required = ['sourceId', 'targetId', 'quantity', 'reason'];
function runtimeFor(modules: readonly FeatureModule[]): Runtime {
  const runtime: Runtime = {
    ...assembleModules(modules),
    activity: createActivityBus(() => 'test'),
    persona: ref('admin'),
    licensedModules: ref<ReadonlySet<string>>(new Set(modules.map((module) => module.id))),
    chunkError: ref(''),
    can(owner, permission) {
      return permitted(runtime, owner, permission);
    },
  };
  return runtime;
}

describe('action field dependencies and required rules', () => {
  const cases: [string, string[]][] = [
    ['inventory-adjust', ['inventory-adjust-field-quantity', 'inventory-adjust-field-reason']],
    [
      'inventory-transfer',
      [
        'inventory-transfer-field-source',
        'inventory-transfer-field-target',
        'inventory-transfer-field-quantity',
        'inventory-transfer-field-reason',
      ],
    ],
    ['approval-reject', ['approval-reject-field-reason']],
  ];
  for (const [action, fields] of cases)
    for (const missing of fields)
      it(`rejects ${action} without ${missing}`, () => {
        const policy = loadPolicy(PROJECT_ROOT, 'enterprise-a');
        expect(() =>
          selectModules(policy.catalog, {
            ...policy.enterprise,
            enabledModules: policy.enterprise.enabledModules.filter((id) => id !== missing),
          }),
        ).toThrow('MISSING_DEPENDENCY');
      });
  it('allows initial approval and review without opinion fields, but not a target field without its source', () => {
    const policy = loadPolicy(PROJECT_ROOT, 'enterprise-a');
    for (const action of ['approval-approve', 'approval-review'])
      expect(
        selectModules(policy.catalog, {
          ...policy.enterprise,
          enabledModules: ['approvals', action],
        }).map((module) => module.id),
      ).toEqual(['approvals', action]);
    expect(() =>
      selectModules(policy.catalog, {
        ...policy.enterprise,
        enabledModules: ['inventory', 'inventory-transfer-field-target'],
      }),
    ).toThrow('MISSING_DEPENDENCY');
  });
  it('requires nonzero integer adjustment, positive integer transfer and nonblank mandatory reasons', () => {
    const adjustment = assembleModules([adjustQuantity, adjustReason]).formFields;
    expect(
      parseForm(adjustment, { delta: -1, reason: '  盘点  ' }, ['delta', 'reason']).values,
    ).toEqual({ delta: -1, reason: '盘点' });
    for (const delta of [0, 0.1, NaN, Infinity, 1000001])
      expect(() => parseForm(adjustment, { delta, reason: '盘点' }, ['delta', 'reason'])).toThrow();
    expect(() => parseForm(adjustment, { delta: 1, reason: ' ' }, ['delta', 'reason'])).toThrow(
      '调整原因',
    );
    const fields = assembleModules(transfer).formFields;
    const valid = { sourceId: 's', targetId: 't', quantity: 1, reason: '补货' };
    for (const amount of [0, -1, 0.5, NaN, 1000001])
      expect(() =>
        parseForm(fields, { ...valid, quantity: amount }, required, { stockItems: stock }),
      ).toThrow();
    expect(() =>
      parseForm(fields, { ...valid, reason: ' ' }, required, { stockItems: stock }),
    ).toThrow('调拨原因');
    expect(() =>
      parseForm(assembleModules([rejectionReason]).formFields, { comment: ' ' }, ['comment']),
    ).toThrow('驳回原因');
    expect(() =>
      parseForm(assembleModules([rejectionReason]).formFields, { comment: 'x'.repeat(201) }, [
        'comment',
      ]),
    ).toThrow();
    expect(() => parseForm([], { comment: '已填写' }, ['comment'])).toThrow('必填字段不可用');
  });
  it('validates optional opinions only when their independent field is present', () => {
    for (const [definition, formTarget] of [
      [initialComment, 'approval-approve'],
      [reviewComment, 'approval-review'],
    ] as const) {
      const fields = assembleModules([definition]).formFields.filter(
        ({ value }) => value.target === formTarget,
      );
      expect(parseForm(fields, { comment: '  ' }, []).values.comment).toBe('');
      expect(parseForm(fields, { comment: '  通过  ' }, []).values.comment).toBe('通过');
      expect(() => parseForm(fields, { comment: 'x'.repeat(201) }, [])).toThrow('200');
      expect(parseForm([], { comment: 'must not submit' }, []).values).not.toHaveProperty(
        'comment',
      );
    }
    const pending = submitApproval('采购', '测试', 50000);
    const review = approveApproval(pending);
    expect(review.status).toBe('复核中');
    expect(review.history.at(-1)?.comment).toBe('同意申请');
    expect(reviewApproval(review).history.at(-1)?.comment).toBe('同意申请');
  });
});

describe('dynamic warehouse fields', () => {
  it('owns its options and rejects an unknown source, same warehouse or mismatched SKU', () => {
    const fields = assembleModules(transfer).formFields;
    const valid = { sourceId: 's', targetId: 't', quantity: 1, reason: '补货' };
    const definition: FormField | undefined = target.contributions.formFields[0];
    if (!definition?.optionsFor) throw new Error('target definition');
    expect(
      definition
        .optionsFor({ values: valid, stockItems: stock })
        .filter((option) => !option.disabled)
        .map((option) => option.value),
    ).toEqual(['t']);
    for (const targetId of ['s', 'x', 'missing'])
      expect(() =>
        parseForm(fields, { ...valid, targetId }, required, { stockItems: stock }),
      ).toThrow('目标仓');
    expect(() =>
      parseForm(fields, { ...valid, sourceId: 'missing' }, required, { stockItems: stock }),
    ).toThrow('源仓商品');
    expect(parseForm(fields, valid, required, { stockItems: stock }).values).toEqual(valid);
  });
  it('resets the target after source changes and blocks after required field revocation or disappearing options', () => {
    const runtime = runtimeFor(transfer);
    const app = createApp({});
    app.provide(runtimeKey, runtime);
    const scope = effectScope();
    const items = ref(stock);
    try {
      const form = scope.run(() =>
        app.runWithContext(() =>
          useConfiguredForm('inventory-transfer', required, () => ({ stockItems: items.value })),
        ),
      );
      if (!form) throw new Error('missing form');
      expect(form.blocked.value).toBe(true);
      form.draft.value.sourceId = 's';
      form.draft.value.targetId = 't';
      form.draft.value.quantity = 2;
      form.draft.value.reason = '补货';
      expect(form.blocked.value).toBe(false);
      form.draft.value.sourceId = 't';
      expect(form.draft.value.targetId).toBe('');
      expect(form.draft.value.quantity).toBe(2);
      expect(form.draft.value.reason).toBe('补货');
      form.draft.value.targetId = 's';
      expect(form.read().values.targetId).toBe('s');
      items.value = stock.filter((item) => item.id !== 's');
      expect(form.blocked.value).toBe(true);
      expect(() => form.read()).toThrow('暂不可用');
      items.value = stock;
      runtime.licensedModules.value = new Set([
        'inventory-transfer-field-source',
        'inventory-transfer-field-target',
        'inventory-transfer-field-quantity',
      ]);
      expect(form.draft.value).not.toHaveProperty('reason');
      expect(form.available.value).toBe(false);
      expect(() => form.read()).toThrow('必填字段不可用');
    } finally {
      scope.stop();
    }
  });
  it('purges an optional opinion and cannot resurrect its draft on re-authorization', () => {
    const runtime = runtimeFor([initialComment]);
    const app = createApp({});
    app.provide(runtimeKey, runtime);
    const scope = effectScope();
    try {
      const form = scope.run(() =>
        app.runWithContext(() => useConfiguredForm('approval-approve', [])),
      );
      if (!form) throw new Error('missing form');
      form.draft.value.comment = 'private draft';
      runtime.licensedModules.value = new Set();
      expect(form.read().values).toEqual({});
      runtime.licensedModules.value = new Set(['approval-approve-field-comment']);
      expect(form.draft.value.comment).toBe('');
    } finally {
      scope.stop();
    }
  });
  it('rejects missing field dependencies and cycles before rendering a form', () => {
    expect(() => assembleModules([target])).toThrow('DANGLING_FORM_DEPENDENCY');
    const sourceField = source.contributions.formFields[0];
    if (!sourceField) throw new Error('source definition');
    expect(() =>
      assembleModules([
        { ...source, contributions: { formFields: [{ ...sourceField, dependsOn: ['targetId'] }] } },
        target,
      ]),
    ).toThrow('FORM_FIELD_DEPENDENCY_CYCLE');
  });
});
