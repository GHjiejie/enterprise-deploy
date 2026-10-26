import type { FeatureModule } from '../../contracts/feature';

export default {
  id: 'order-field-reference',
  contributions: {
    formFields: [
      {
        id: 'order-field-reference',
        target: 'order-create',
        key: 'reference',
        order: 30,
        permission: 'reference.edit',
        label: '客户参考号',
        control: 'text',
        initial: '',
        required: false,
        purpose: 'extension',
        maxLength: 40,
        parse: (value) => {
          if (
            typeof value !== 'string' ||
            (value.trim() && !/^[A-Za-z0-9-]{1,40}$/u.test(value.trim()))
          )
            throw new Error('客户参考号仅允许 1–40 位字母、数字和短横线。');
          return value.trim();
        },
      },
    ],
  },
} satisfies FeatureModule;
