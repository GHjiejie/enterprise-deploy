import { describe, expect, it } from 'vitest';
import { createApp, effectScope, ref } from 'vue';
import type { FeatureModule, Runtime } from '../../src/contracts/feature';
import { runtimeKey } from '../../src/contracts/feature';
import type { FormField } from '../../src/contracts/presentation';
import { assembleModules } from '../../src/composition/assemble';
import { createActivityBus } from '../../src/core/activity';
import { permitted } from '../../src/core/runtime';
import { parseForm } from '../../src/shared/form';
import { useConfiguredForm } from '../../src/shared/useConfiguredForm';
import title from '../../src/modules/approval-field-title';
import applicant from '../../src/modules/approval-field-applicant';
import amount from '../../src/modules/approval-field-amount';
import costCenter from '../../src/modules/approval-field-cost-center';
import urgency from '../../src/modules/approval-field-urgency';
import reference from '../../src/modules/order-field-reference';
import { approveApproval } from '../../src/modules/approval-approve/model';
import { rejectApproval } from '../../src/modules/approval-reject/model';
import { reviewApproval } from '../../src/modules/approval-review/model';
import { submitApproval } from '../../src/modules/approval-submit/model';

const required = ['title', 'applicant', 'amount'];
const definitions = [title, applicant, amount, costCenter, urgency];
const valid = {
  title: '采购',
  applicant: '林晓',
  amount: 50000,
  costCenter: 'RD-001',
  urgency: '紧急',
};
const field: FormField = {
  id: 'example-field',
  target: 'order-create',
  key: 'reference',
  order: 1,
  permission: 'field.edit',
  label: '示例字段',
  control: 'text',
  initial: '',
  required: false,
  purpose: 'extension',
  parse: (value) => value,
};

function runtimeFor(modules: readonly FeatureModule[]): Runtime {
  const assembly = assembleModules(modules);
  const runtime: Runtime = {
    ...assembly,
    activity: createActivityBus(() => '测试'),
    persona: ref('admin'),
    licensedModules: ref<ReadonlySet<string>>(new Set(modules.map((module) => module.id))),
    chunkError: ref(''),
    can(owner, permission) {
      return permitted(runtime, owner, permission);
    },
  };
  return runtime;
}

describe('independently delivered approval actions', () => {
  it('does not let initial approval perform review or review perform initial approval', () => {
    const pending = submitApproval('采购', '测试', 50000);
    expect(() => reviewApproval(pending, '复核')).toThrow('当前阶段');
    const review = approveApproval(pending, '初审');
    expect(review.status).toBe('复核中');
    expect(() => approveApproval(review, '越过复核')).toThrow('当前阶段');
    expect(reviewApproval(review, '复核').status).toBe('已通过');
    expect(rejectApproval(review, '预算不足').status).toBe('已驳回');
    expect(pending.status).toBe('待审批');
  });
});

describe('configured form boundaries', () => {
  it('normalizes delivered fields, excludes unregistered data and stores only extension entries', () => {
    const assembly = assembleModules(definitions);
    const result = parseForm(
      assembly.formFields,
      { ...valid, title: '  采购  ', costCenter: ' RD-001 ', undeclared: 'do not submit' },
      required,
    );
    expect(result.values).toEqual(valid);
    expect(result.extra).toEqual([
      { key: 'costCenter', label: '成本中心', value: 'RD-001' },
      { key: 'urgency', label: '紧急程度', value: '紧急' },
    ]);
    const trimmed = parseForm(
      assembleModules([title, applicant, amount]).formFields,
      valid,
      required,
    );
    expect(trimmed.extra).toEqual([]);
    expect(trimmed.values).not.toHaveProperty('costCenter');
    expect(trimmed.values).not.toHaveProperty('urgency');
  });
  it('rejects invalid optional values and missing business-required fields', () => {
    const fields = assembleModules(definitions).formFields;
    expect(() => parseForm(fields, { ...valid, costCenter: 'bad' }, required)).toThrow('成本中心');
    expect(() => parseForm(fields, { ...valid, urgency: '绕过' }, required)).toThrow('紧急程度');
    expect(() => parseForm(fields, { ...valid, amount: NaN }, required)).toThrow('金额');
    expect(() =>
      parseForm(assembleModules([title, applicant]).formFields, valid, required),
    ).toThrow('必填字段不可用');
    expect(parseForm(assembleModules([reference]).formFields, { reference: '' }, []).extra).toEqual(
      [],
    );
    expect(() =>
      parseForm(assembleModules([reference]).formFields, { reference: '!invalid' }, []),
    ).toThrow('客户参考号');
  });
  it('purges revoked fields and prevents stale values returning after permission changes', () => {
    const runtime = runtimeFor(definitions);
    const app = createApp({});
    app.provide(runtimeKey, runtime);
    const scope = effectScope();
    try {
      const form = scope.run(() =>
        app.runWithContext(() => useConfiguredForm('approval-submit', required)),
      );
      if (!form) throw new Error('form scope');
      form.draft.value = { ...valid };
      runtime.persona.value = 'member';
      expect(form.draft.value).not.toHaveProperty('costCenter');
      expect(form.read().extra).toEqual([{ key: 'urgency', label: '紧急程度', value: '紧急' }]);
      runtime.persona.value = 'admin';
      expect(form.draft.value.costCenter).toBe('');
      runtime.licensedModules.value = new Set([
        'approval-field-applicant',
        'approval-field-amount',
      ]);
      expect(form.available.value).toBe(false);
      expect(() => form.read()).toThrow('必填字段不可用');
    } finally {
      scope.stop();
    }
  });
});

describe('presentation composition', () => {
  it('rejects duplicate field keys, cross-kind IDs, unsafe keys and invalid targets', () => {
    expect(() =>
      assembleModules([
        { id: 'x', contributions: { formFields: [field, { ...field, id: 'other-field' }] } },
      ]),
    ).toThrow('FORM_FIELD_CONFLICT');
    expect(() =>
      assembleModules([
        { id: 'x', contributions: { formFields: [{ ...field, key: 'constructor' }] } },
      ]),
    ).toThrow('FORM_FIELD_CONFLICT');
    expect(() =>
      assembleModules([{ id: 'x', contributions: { formFields: [{ ...field, label: '' }] } }]),
    ).toThrow('INVALID_FORM_FIELD');
    expect(() =>
      assembleModules([
        {
          id: 'x',
          contributions: {
            formFields: [field],
            columns: [
              {
                id: field.id,
                target: 'orders',
                title: '列',
                order: 1,
                permission: 'read',
                component: {},
              },
            ],
          },
        },
      ]),
    ).toThrow('CONTRIBUTION_CONFLICT');
    expect(() =>
      assembleModules([
        {
          id: 'x',
          contributions: {
            detailTabs: [
              {
                id: 'empty',
                target: 'order-detail',
                title: '',
                order: 1,
                permission: 'read',
                component: {},
              },
            ],
          },
        },
      ]),
    ).toThrow('INVALID_DETAIL_TAB');
  });
  it('sorts columns and tabs stably and declares independent permissions', () => {
    const runtime = runtimeFor([
      {
        id: 'x',
        demoMemberPermissions: ['column.read'],
        contributions: {
          columns: [
            {
              id: 'second',
              target: 'orders',
              title: '第二列',
              order: 20,
              permission: 'column.read',
              component: {},
            },
            {
              id: 'first',
              target: 'orders',
              title: '第一列',
              order: 10,
              permission: 'column.read',
              component: {},
            },
          ],
          detailTabs: [
            {
              id: 'tab',
              target: 'order-detail',
              title: '页签',
              order: 10,
              permission: 'tab.read',
              component: {},
            },
          ],
        },
      },
    ]);
    expect(runtime.columns.map((column) => column.value.id)).toEqual(['first', 'second']);
    runtime.persona.value = 'member';
    expect(runtime.can('x', 'column.read')).toBe(true);
    expect(runtime.can('x', 'tab.read')).toBe(false);
    expect(Object.isFrozen(runtime.detailTabs)).toBe(true);
  });
});
