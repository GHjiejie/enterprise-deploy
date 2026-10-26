import type { FeatureModule } from '../../contracts/feature';
export default {
  id: 'stocktake-create-field-note',
  contributions: {
    formFields: [
      {
        id: 'stocktake-create-field-note',
        target: 'stocktake-create',
        key: 'note',
        order: 30,
        permission: 'note.edit',
        label: '盘点备注',
        control: 'textarea',
        initial: '',
        required: false,
        purpose: 'extension',
        maxLength: 200,
        parse: (value) => {
          if (typeof value !== 'string' || value.trim().length > 200)
            throw new Error('盘点备注须为不超过 200 字的文本。');
          return value.trim();
        },
      },
    ],
  },
} satisfies FeatureModule;
