import type { FeatureModule } from '../../contracts/feature';

export default {
  id: 'approval-field-cost-center',
  contributions: {
    formFields: [
      {
        id: 'approval-field-cost-center',
        target: 'approval-submit',
        key: 'costCenter',
        order: 40,
        permission: 'costCenter.edit',
        label: '成本中心',
        control: 'text',
        initial: '',
        required: false,
        purpose: 'extension',
        maxLength: 6,
        parse: (value) => {
          if (
            typeof value !== 'string' ||
            (value.trim() && !/^[A-Z]{2}-[0-9]{3}$/u.test(value.trim()))
          )
            throw new Error('成本中心格式应为两个大写字母、短横线及三位数字，例如 RD-001。');
          return value.trim();
        },
      },
    ],
  },
} satisfies FeatureModule;
