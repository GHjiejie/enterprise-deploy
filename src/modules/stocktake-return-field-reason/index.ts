import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'stocktake-return-field-reason',
  contributions: {
    formFields: [
      {
        id: 'stocktake-return-field-reason',
        target: 'stocktake-return',
        key: 'reason',
        order: 10,
        permission: 'reason.edit',
        label: '重盘原因',
        control: 'textarea',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 200,
        parse: (value) => requiredText(typeof value === 'string' ? value : '', '重盘原因', 200),
      },
    ],
  },
} satisfies FeatureModule;
