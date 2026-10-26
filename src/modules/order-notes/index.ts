import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'order-notes',
  contributions: {
    detailTabs: [
      {
        id: 'order-notes',
        target: 'order-detail',
        title: '跟进备注',
        order: 20,
        permission: 'order.note',
        component: defineAsyncComponent({
          loader: () => import('./OrderNotes.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
