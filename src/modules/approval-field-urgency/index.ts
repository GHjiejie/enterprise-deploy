import type { FeatureModule } from '../../contracts/feature';

export default {
  id: 'approval-field-urgency',
  demoMemberPermissions: ['urgency.edit'],
  contributions: {
    formFields: [
      {
        id: 'approval-field-urgency',
        target: 'approval-submit',
        key: 'urgency',
        order: 50,
        permission: 'urgency.edit',
        label: '紧急程度',
        control: 'select',
        initial: '普通',
        required: false,
        purpose: 'extension',
        options: [
          { value: '普通', label: '普通' },
          { value: '紧急', label: '紧急' },
        ],
        parse: (value) => {
          if (value !== '普通' && value !== '紧急') throw new Error('请选择有效的紧急程度。');
          return value;
        },
      },
    ],
  },
} satisfies FeatureModule;
