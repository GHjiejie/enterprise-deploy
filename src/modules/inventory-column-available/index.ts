import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'inventory-column-available',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'inventory-column-available',
        target: 'inventory',
        title: '可用 / 预警线',
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
