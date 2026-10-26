import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-create',

  contributions: {
    stocktakeTools: [
      {
        id: 'stocktake-create',
        order: 10,
        permission: 'stocktake.create',
        guide: {
          routeName: 'stocktakes',
          title: '创建盘点单',
          description:
            '点击这里填写盘点名称、选择仓库。保存后固定该仓账面快照；同仓已有未结束盘点时需要先处理原单据。',
        },
        component: defineAsyncComponent({
          loader: () => import('./StocktakeCreate.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
