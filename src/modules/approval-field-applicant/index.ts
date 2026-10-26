import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'approval-field-applicant',
  demoMemberPermissions: ['applicant.edit'],
  contributions: {
    formFields: [
      {
        id: 'approval-field-applicant',
        target: 'approval-submit',
        key: 'applicant',
        order: 20,
        permission: 'applicant.edit',
        label: '申请人',
        control: 'text',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 40,
        parse: (value) => requiredText(typeof value === 'string' ? value : '', '申请人', 40),
      },
    ],
  },
} satisfies FeatureModule;
