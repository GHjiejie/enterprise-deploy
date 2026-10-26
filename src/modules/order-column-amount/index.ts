import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'order-column-amount',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'order-column-amount',
        target: 'orders',
        title: '订单金额',
        order: 20,
        permission: 'column.read',
        component: defineAsyncComponent({
          loader: () => import('./Cell.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
