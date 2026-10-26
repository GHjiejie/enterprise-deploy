import type { FeatureModule } from '../../contracts/feature';
import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'order-bulk-complete',
  contributions: {
    orderTools: [
      {
        id: 'order-bulk-complete',
        order: 20,
        permission: 'order.complete',
        guide: {
          routeName: 'orders',
          title: '批量完成订单',
          description:
            '先在列表中勾选待处理订单，再点击这里核对所选订单并确认完成。未选择订单或包含已完成订单时按钮不可用。',
        },
        component: defineAsyncComponent({
          loader: () => import('./BulkComplete.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
