import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-cancel',

  contributions: {
    stocktakeRows: [
      {
        id: 'stocktake-cancel',
        order: 70,
        permission: 'stocktake.cancel',
        component: defineAsyncComponent({
          loader: () => import('./Action.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
