import type { FeatureModule } from '../../contracts/feature';

export default {
  id: 'approval-approve-field-comment',
  contributions: {
    formFields: [
      {
        id: 'approval-approve-field-comment',
        target: 'approval-approve',
        key: 'comment',
        order: 10,
        permission: 'comment.edit',
        label: '审批意见',
        control: 'textarea',
        initial: '',
        required: false,
        purpose: 'extension',
        maxLength: 200,
        hint: '可留空；未填写时记录默认意见。',
        parse: (value) => {
          if (typeof value !== 'string' || value.trim().length > 200)
            throw new Error('初审意见须为不超过 200 字的文本。');
          return value.trim();
        },
      },
    ],
  },
} satisfies FeatureModule;
