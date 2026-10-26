import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'order-column-status',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'order-column-status',
        target: 'orders',
        title: '状态',
        order: 30,
        permission: 'column.read',
        component: defineAsyncComponent({
          loader: () => import('./Cell.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
