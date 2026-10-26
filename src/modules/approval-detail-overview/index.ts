import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-detail-overview',
  demoMemberPermissions: ['tab.read'],
  contributions: {
    detailTabs: [
      {
        id: 'approval-detail-overview',
        target: 'approval-detail',
        title: '申请信息',
        order: 10,
        permission: 'tab.read',
        component: defineAsyncComponent({
          loader: () => import('./Panel.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
