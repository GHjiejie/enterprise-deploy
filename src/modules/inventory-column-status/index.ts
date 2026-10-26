import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'inventory-column-status',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'inventory-column-status',
        target: 'inventory',
        title: '状态',
        order: 40,
        permission: 'column.read',
        component: defineAsyncComponent({
          loader: () => import('./Cell.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
