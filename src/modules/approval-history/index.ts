import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-history',
  demoMemberPermissions: ['approval.history'],
  contributions: {
    detailTabs: [
      {
        id: 'approval-history',
        target: 'approval-detail',
        title: '审批记录',
        order: 20,
        permission: 'approval.history',
        component: defineAsyncComponent({
          loader: () => import('./ApprovalHistory.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
