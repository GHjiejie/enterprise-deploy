import type { FeatureModule } from '../../contracts/feature';
export default {
  id: 'stocktake-count-field-quantity',
  contributions: {
    formFields: [
      {
        id: 'stocktake-count-field-quantity',
        target: 'stocktake-count',
        key: 'quantity',
        order: 10,
        permission: 'quantity.edit',
        label: '实盘数量',
        control: 'number',
        initial: 0,
        required: true,
        purpose: 'required',
        min: 0,
        max: 1000000,
        step: 1,
        parse: (value) => {
          if (
            typeof value !== 'number' ||
            !Number.isSafeInteger(value) ||
            value < 0 ||
            value > 1000000
          )
            throw new Error('实盘数量须为 0–100 万的整数。');
          return value;
        },
      },
    ],
  },
} satisfies FeatureModule;
