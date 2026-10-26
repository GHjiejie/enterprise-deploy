import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'inventory-column-quantity',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'inventory-column-quantity',
        target: 'inventory',
        title: '实存',
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
