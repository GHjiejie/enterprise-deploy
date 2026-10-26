import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-column-difference',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'stocktake-column-difference',
        target: 'stocktakes',
        title: '净差异',
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
