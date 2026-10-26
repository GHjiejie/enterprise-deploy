import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'approval-reject-field-reason',
  contributions: {
    formFields: [
      {
        id: 'approval-reject-field-reason',
        target: 'approval-reject',
        key: 'comment',
        order: 10,
        permission: 'comment.edit',
        label: '驳回原因',
        control: 'textarea',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 200,
        parse: (value) => requiredText(typeof value === 'string' ? value : '', '驳回原因', 200),
      },
    ],
  },
} satisfies FeatureModule;
