import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-review',
  contributions: {
    approvalRows: [
      {
        id: 'approval-review',
        order: 20,
        permission: 'approval.review',
        component: defineAsyncComponent({
          loader: () => import('./Action.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
