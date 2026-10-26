import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-column-progress',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'stocktake-column-progress',
        target: 'stocktakes',
        title: '盘点进度',
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
