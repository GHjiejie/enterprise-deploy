import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-column-status',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'stocktake-column-status',
        target: 'stocktakes',
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
