import type { FeatureModule } from '../../contracts/feature';
import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'inventory-adjust',
  contributions: {
    inventoryRows: [
      {
        id: 'inventory-adjust',
        order: 10,
        permission: 'inventory.adjust',
        component: defineAsyncComponent({
          loader: () => import('./StockAdjust.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
