import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-count',

  contributions: {
    stocktakeLines: [
      {
        id: 'stocktake-count',
        order: 20,
        permission: 'stocktake.count',
        component: defineAsyncComponent({
          loader: () => import('./StocktakeCount.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
