import type { FeatureModule } from '../../contracts/feature';
import { integer } from '../../shared/validation';
export default {
  id: 'inventory-adjust-field-quantity',
  contributions: {
    formFields: [
      {
        id: 'inventory-adjust-field-quantity',
        target: 'inventory-adjust',
        key: 'delta',
        order: 10,
        permission: 'delta.edit',
        label: '调整数量',
        control: 'number',
        initial: 0,
        required: true,
        purpose: 'required',
        min: -1000000,
        max: 1000000,
        step: 1,
        hint: '正数表示盘盈，负数表示盘亏。',
        parse: (value) => {
          const quantity = integer(typeof value === 'number' ? value : NaN, '调整数量');
          if (!quantity) throw new Error('调整数量不能为 0。');
          return quantity;
        },
      },
    ],
  },
} satisfies FeatureModule;
