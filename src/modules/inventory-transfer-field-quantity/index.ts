import type { FeatureModule } from '../../contracts/feature';
import { integer } from '../../shared/validation';
export default {
  id: 'inventory-transfer-field-quantity',
  contributions: {
    formFields: [
      {
        id: 'inventory-transfer-field-quantity',
        target: 'inventory-transfer',
        key: 'quantity',
        order: 30,
        permission: 'quantity.edit',
        label: '调拨数量',
        control: 'number',
        initial: 1,
        required: true,
        purpose: 'required',
        min: 1,
        max: 1000000,
        step: 1,
        parse: (value) => {
          const quantity = integer(typeof value === 'number' ? value : NaN, '调拨数量');
          if (quantity <= 0) throw new Error('调拨数量必须大于 0。');
          return quantity;
        },
      },
    ],
  },
} satisfies FeatureModule;
