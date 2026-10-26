import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'inventory-transfer-field-reason',
  contributions: {
    formFields: [
      {
        id: 'inventory-transfer-field-reason',
        target: 'inventory-transfer',
        key: 'reason',
        order: 40,
        permission: 'reason.edit',
        label: '调拨原因',
        control: 'textarea',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 200,
        parse: (value) => requiredText(typeof value === 'string' ? value : '', '调拨原因', 200),
      },
    ],
  },
} satisfies FeatureModule;
