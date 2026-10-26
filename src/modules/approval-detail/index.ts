import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-detail',
  demoMemberPermissions: ['approval.detail'],
  contributions: {
    approvalRows: [
      {
        id: 'approval-detail',
        order: 50,
        permission: 'approval.detail',
        component: defineAsyncComponent({
          loader: () => import('./ApprovalDetail.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
