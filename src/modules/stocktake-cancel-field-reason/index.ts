import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'stocktake-cancel-field-reason',
  contributions: {
    formFields: [
      {
        id: 'stocktake-cancel-field-reason',
        target: 'stocktake-cancel',
        key: 'reason',
        order: 10,
        permission: 'reason.edit',
        label: '作废原因',
        control: 'textarea',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 200,
        parse: (value) => requiredText(typeof value === 'string' ? value : '', '作废原因', 200),
      },
    ],
  },
} satisfies FeatureModule;
