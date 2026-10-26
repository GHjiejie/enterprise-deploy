import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'inventory-column-reserved',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'inventory-column-reserved',
        target: 'inventory',
        title: '预留',
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
