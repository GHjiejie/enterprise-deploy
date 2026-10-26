import type { FeatureModule } from '../../contracts/feature';
import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'order-create',
  contributions: {
    orderTools: [
      {
        id: 'order-create',
        order: 10,
        permission: 'order.create',
        guide: {
          routeName: 'orders',
          title: '新建订单',
          description:
            '点击这个按钮填写订单信息。表单会显示当前企业已启用的字段，提交后新订单出现在列表中。',
        },
        component: defineAsyncComponent({
          loader: () => import('./CreateOrder.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
