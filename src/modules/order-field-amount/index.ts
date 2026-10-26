import type { FeatureModule } from '../../contracts/feature';
import { positiveAmount } from '../../shared/validation';
export default {
  id: 'order-field-amount',
  contributions: {
    formFields: [
      {
        id: 'order-field-amount',
        target: 'order-create',
        key: 'amount',
        order: 20,
        permission: 'amount.edit',
        label: '订单金额',
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
