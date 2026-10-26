import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'order-column-customer',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'order-column-customer',
        target: 'orders',
        title: '客户',
        order: 10,
        permission: 'column.read',
        component: defineAsyncComponent({
          loader: () => import('./Cell.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
