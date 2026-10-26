import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-post',

  contributions: {
    stocktakeRows: [
      {
        id: 'stocktake-post',
        order: 60,
        permission: 'stocktake.post',
        component: defineAsyncComponent({
          loader: () => import('./Action.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
