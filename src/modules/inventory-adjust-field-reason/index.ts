import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'inventory-adjust-field-reason',
  contributions: {
    formFields: [
      {
        id: 'inventory-adjust-field-reason',
        target: 'inventory-adjust',
        key: 'reason',
        order: 20,
        permission: 'reason.edit',
        label: '调整原因',
        control: 'textarea',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 200,
        parse: (value) => requiredText(typeof value === 'string' ? value : '', '调整原因', 200),
      },
    ],
  },
} satisfies FeatureModule;
