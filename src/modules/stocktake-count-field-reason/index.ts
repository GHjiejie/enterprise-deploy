import type { FeatureModule } from '../../contracts/feature';
import { requiredText } from '../../shared/validation';
export default {
  id: 'stocktake-count-field-reason',
  contributions: {
    formFields: [
      {
        id: 'stocktake-count-field-reason',
        target: 'stocktake-count',
        key: 'reason',
        order: 20,
        permission: 'reason.edit',
        label: '盘点差异原因',
        control: 'textarea',
        initial: '',
        required: true,
        purpose: 'required',
        maxLength: 200,
        dependsOn: ['quantity'],
        requiredWhen: (context) => context.values.quantity !== context.stocktakeLine?.bookQuantity,
        hintFor: (context) =>
          context.values.quantity !== context.stocktakeLine?.bookQuantity
            ? '实盘数与账面数不同，必须说明差异原因。'
            : '账实相符时无需填写差异原因。',
        parse: (value, context) => {
          if (!context.stocktakeLine) throw new Error('盘点明细已失效。');
          return context.values.quantity === context.stocktakeLine.bookQuantity
            ? ''
            : requiredText(typeof value === 'string' ? value : '', '盘点差异原因', 200);
        },
      },
    ],
  },
} satisfies FeatureModule;
