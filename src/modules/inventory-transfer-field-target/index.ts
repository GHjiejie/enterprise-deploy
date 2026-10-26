import type { FeatureModule } from '../../contracts/feature';

export default {
  id: 'inventory-transfer-field-target',
  contributions: {
    formFields: [
      {
        id: 'inventory-transfer-field-target',
        target: 'inventory-transfer',
        key: 'targetId',
        order: 20,
        permission: 'targetId.edit',
        label: '目标仓',
        control: 'select',
        initial: '',
        required: true,
        purpose: 'required',
        dependsOn: ['sourceId'],
        optionsFor: (context) => {
          const source = context.stockItems?.find((item) => item.id === context.values.sourceId);
          return [
            { value: '', label: '请选择目标仓', disabled: true },
            ...(context.stockItems ?? [])
              .filter(
                (item) => source && item.sku === source.sku && item.warehouse !== source.warehouse,
              )
              .map((item) => ({ value: item.id, label: item.warehouse })),
          ];
        },
        disabledWhen: (context) => {
          const source = context.stockItems?.find((item) => item.id === context.values.sourceId);
          return (
            !source ||
            !context.stockItems?.some(
              (item) => item.sku === source.sku && item.warehouse !== source.warehouse,
            )
          );
        },
        hintFor: (context) => {
          const source = context.stockItems?.find((item) => item.id === context.values.sourceId);
          if (!source) return '请先选择源仓商品。';
          return context.stockItems?.some(
            (item) => item.sku === source.sku && item.warehouse !== source.warehouse,
          )
            ? ''
            : '同商品没有其他可用仓库。';
        },
        parse: (value, context) => {
          const source = context.stockItems?.find((item) => item.id === context.values.sourceId);
          if (
            typeof value !== 'string' ||
            !source ||
            !context.stockItems?.some(
              (item) =>
                item.id === value && item.sku === source.sku && item.warehouse !== source.warehouse,
            )
          )
            throw new Error('请选择同一商品的其他目标仓。');
          return value;
        },
      },
    ],
  },
} satisfies FeatureModule;
