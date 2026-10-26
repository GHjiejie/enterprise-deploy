import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-approve',

  contributions: {
    stocktakeRows: [
      {
        id: 'stocktake-approve',
        order: 40,
        permission: 'stocktake.approve',
        component: defineAsyncComponent({
          loader: () => import('./Action.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
