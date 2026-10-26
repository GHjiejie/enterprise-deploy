import type { FeatureModule } from '../../contracts/feature';

export default {
  id: 'inventory-transfer-field-source',
  contributions: {
    formFields: [
      {
        id: 'inventory-transfer-field-source',
        target: 'inventory-transfer',
        key: 'sourceId',
        order: 10,
        permission: 'sourceId.edit',
        label: '源仓商品',
        control: 'select',
        initial: '',
        required: true,
        purpose: 'required',
        optionsFor: (context) => [
          { value: '', label: '请选择源仓商品', disabled: true },
          ...(context.stockItems ?? []).map((item) => ({
            value: item.id,
            label: `${item.name} · ${item.warehouse}（可用 ${item.quantity - item.reserved}）`,
          })),
        ],
        disabledWhen: (context) => !context.stockItems?.length,
        hintFor: (context) => (context.stockItems?.length ? '' : '当前没有可调拨的库存记录。'),
        parse: (value, context) => {
          if (typeof value !== 'string' || !context.stockItems?.some((item) => item.id === value))
            throw new Error('请选择有效的源仓商品。');
          return value;
        },
      },
    ],
  },
} satisfies FeatureModule;
