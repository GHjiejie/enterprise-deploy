import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'approval-field-title',
  demoMemberPermissions: ['title.edit'],
  contributions: {
    formFields: [
      {
        id: 'approval-field-title',
        target: 'approval-submit',
        key: 'title',
        order: 10,
        permission: 'title.edit',
        label: '申请事由',
        control: 'textarea',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 120,
        parse: (value) => requiredText(typeof value === 'string' ? value : '', '申请事由', 120),
      },
    ],
  },
} satisfies FeatureModule;
