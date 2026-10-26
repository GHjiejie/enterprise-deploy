import type { FeatureModule } from '../../contracts/feature';
import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'order-priority',
  contributions: {
    orderRows: [
      {
        id: 'order-priority',
        order: 10,
        permission: 'order.priority',
        component: defineAsyncComponent({
          loader: () => import('./PriorityButton.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
