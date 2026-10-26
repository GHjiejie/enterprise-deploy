import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'order-field-customer',
  contributions: {
    formFields: [
      {
        id: 'order-field-customer',
        target: 'order-create',
        key: 'customer',
        order: 10,
        permission: 'customer.edit',
        label: '客户名称',
        control: 'text',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 60,
        parse: (value) => requiredText(typeof value === 'string' ? value : '', '客户名称', 60),
      },
    ],
  },
} satisfies FeatureModule;
