import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';

export default {
  id: 'order-export',
  contributions: {
    orderTools: [
      {
        id: 'order-export-button',
        order: 100,
        permission: 'order.export',
        component: defineAsyncComponent({
          loader: () => import('./ExportButton.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
