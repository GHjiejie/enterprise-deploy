import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';

export default {
  id: 'order-export',
  contributions: {
    orderTools: [
      {
        id: 'order-export-button',
        order: 100,
        permission: 'order.export',
        guide: {
          routeName: 'orders',
          title: '导出订单',
          description:
            '先勾选需要导出的订单，再点击这里下载 CSV 文件。只会导出所选订单；未选择时按钮不可用。',
        },
        component: defineAsyncComponent({
          loader: () => import('./ExportButton.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
