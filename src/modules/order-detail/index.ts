import type { FeatureModule } from '../../contracts/feature';
import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'order-detail',
  demoMemberPermissions: ['order.detail'],
  contributions: {
    orderRows: [
      {
        id: 'order-detail',
        order: 20,
        permission: 'order.detail',
        component: defineAsyncComponent({
          loader: () => import('./OrderDetail.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
