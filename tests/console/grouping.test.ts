import { describe, expect, it } from 'vitest';
import { createProfileStore } from '../../build/console/store';
import { groupCapabilities, planSelection } from '../../build/console/grouping';
import { draftErrors } from '../../build/console/contracts';
import { PROJECT_ROOT } from '../../build/utils';
const { modules, brands } = createProfileStore(PROJECT_ROOT).summaries();
describe('module-oriented configuration', () => {
  it('places every capability in one business group and fields beside their operation', () => {
    const groups = groupCapabilities(modules);
    expect(groups.map((group) => group.id)).toEqual([
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
      'onboarding',
    ]);
    expect(groups.flatMap((group) => group.capabilities)).toHaveLength(120);
    expect(new Set(groups.flatMap((group) => group.capabilities.map((item) => item.id))).size).toBe(
      120,
    );
    for (const [field, action] of [
      ['inventory-transfer-field-target', 'inventory-transfer'],
      ['approval-reject-field-reason', 'approval-reject'],
      ['stocktake-count-field-reason', 'stocktake-count'],
    ]) {
      expect(modules.find((item) => item.id === field)?.section).toBe(
        modules.find((item) => item.id === action)?.section,
      );
    }
    expect(modules.find((item) => item.id === 'stocktake-detail-lines')?.kind).toBe('tab');
  });
  it('previews full dependency closure without mutating the draft or enabling optional opinions', () => {
    const selected = ['orders'];
    const proposal = planSelection(modules, selected, ['stocktake-count'], true);
    expect(proposal.added).toEqual([
      'inventory',
      'stocktake-count',
      'stocktake-count-field-quantity',
      'stocktake-count-field-reason',
      'stocktake-detail',
      'stocktake-detail-lines',
      'stocktakes',
    ]);
    expect(selected).toEqual(['orders']);
    expect(proposal.removed).toEqual([]);
    expect(
      draftErrors(
        {
          schemaVersion: 1,
          enterpriseId: 'valid',
          brandingId: 'brand-a',
          enabledModules: proposal.next,
        },
        modules,
        brands,
      ),
    ).toEqual([]);
    expect(planSelection(modules, [], ['stocktake-approve'], true).next).not.toContain(
      'stocktake-approve-field-comment',
    );
  });
  it('previews transitive cross-group removals without affecting unrelated capabilities', () => {
    const selected = modules.map((item) => item.id);
    const proposal = planSelection(modules, selected, ['inventory'], false);
    expect(proposal.removed).toContain('stocktake-count-field-reason');
    expect(proposal.removed).toContain('stocktake-detail-extra');
    expect(proposal.next).toContain('approval-review-field-comment');
    expect(proposal.next).toContain('order-export');
    expect(
      draftErrors(
        {
          schemaVersion: 1,
          enterpriseId: 'valid',
          brandingId: 'brand-a',
          enabledModules: proposal.next,
        },
        modules,
        brands,
      ),
    ).toEqual([]);
    expect(selected).toHaveLength(120);
  });
});
