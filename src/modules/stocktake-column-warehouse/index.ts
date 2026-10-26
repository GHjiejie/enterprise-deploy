import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-column-warehouse',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'stocktake-column-warehouse',
        target: 'stocktakes',
        title: '仓库',
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
