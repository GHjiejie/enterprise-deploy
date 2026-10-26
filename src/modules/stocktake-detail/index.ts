import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-detail',
  demoMemberPermissions: ['stocktake.detail'],
  contributions: {
    stocktakeRows: [
      {
        id: 'stocktake-detail',
        order: 80,
        permission: 'stocktake.detail',
        component: defineAsyncComponent({
          loader: () => import('./Detail.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
