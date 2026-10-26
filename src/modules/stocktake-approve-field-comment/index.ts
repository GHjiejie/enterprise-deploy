import type { FeatureModule } from '../../contracts/feature';
export default {
  id: 'stocktake-approve-field-comment',
  contributions: {
    formFields: [
      {
        id: 'stocktake-approve-field-comment',
        target: 'stocktake-approve',
        key: 'comment',
        order: 10,
        permission: 'comment.edit',
        label: '盘点复核意见',
        control: 'textarea',
        initial: '',
        required: false,
        purpose: 'extension',
        maxLength: 200,
        parse: (value) => {
          if (typeof value !== 'string' || value.trim().length > 200)
            throw new Error('盘点复核说明最多输入 200 字。');
          return value.trim();
        },
      },
    ],
  },
} satisfies FeatureModule;
