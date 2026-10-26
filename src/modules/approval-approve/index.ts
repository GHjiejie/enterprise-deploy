import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-approve',
  contributions: {
    approvalRows: [
      {
        id: 'approval-approve',
        order: 10,
        permission: 'approval.approve',
        component: defineAsyncComponent({
          loader: () => import('./Action.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
