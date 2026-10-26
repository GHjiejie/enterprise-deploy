import type { FeatureModule } from '../../contracts/feature';
export default {
  id: 'stocktake-create-field-warehouse',
  contributions: {
    formFields: [
      {
        id: 'stocktake-create-field-warehouse',
        target: 'stocktake-create',
        key: 'warehouse',
        order: 20,
        permission: 'warehouse.edit',
        label: '盘点仓库',
        control: 'select',
        initial: '',
        required: true,
        purpose: 'required',
        optionsFor: (context) => [
          { value: '', label: '请选择盘点仓库', disabled: true },
          ...[...new Set((context.stockItems ?? []).map((item) => item.warehouse))].map((name) => ({
            value: name,
            label: name,
          })),
        ],
        disabledWhen: (context) => !context.stockItems?.length,
        hintFor: (context) =>
          context.stockItems?.length
            ? '将包含所选仓库的全部商品，保存时固定账面快照。'
            : '暂无可盘点的库存记录。',
        parse: (value, context) => {
          if (
            typeof value !== 'string' ||
            !context.stockItems?.some((item) => item.warehouse === value)
          )
            throw new Error('请选择有效的盘点仓库。');
          return value;
        },
      },
    ],
  },
} satisfies FeatureModule;
