import type { FeatureModule } from '../../contracts/feature';
import { positiveAmount } from '../../shared/validation';
export default {
  id: 'approval-field-amount',
  demoMemberPermissions: ['amount.edit'],
  contributions: {
    formFields: [
      {
        id: 'approval-field-amount',
        target: 'approval-submit',
        key: 'amount',
        order: 30,
        permission: 'amount.edit',
        label: '申请金额',
        control: 'number',
        initial: 0,
        required: true,
        purpose: 'required',
        min: 0.01,
        max: 100000000,
        step: 0.01,
        parse: (value) => positiveAmount(typeof value === 'number' ? value : NaN),
      },
    ],
  },
} satisfies FeatureModule;
