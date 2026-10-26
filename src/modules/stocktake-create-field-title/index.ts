import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'stocktake-create-field-title',
  contributions: {
    formFields: [
      {
        id: 'stocktake-create-field-title',
        target: 'stocktake-create',
        key: 'title',
        order: 10,
        permission: 'title.edit',
        label: '盘点名称',
        control: 'text',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 80,
        parse: (value) => requiredText(typeof value === 'string' ? value : '', '盘点名称', 80),
      },
    ],
  },
} satisfies FeatureModule;
