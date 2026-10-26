import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'order-detail-overview',
  demoMemberPermissions: ['tab.read'],
  contributions: {
    detailTabs: [
      {
        id: 'order-detail-overview',
        target: 'order-detail',
        title: '基本信息',
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
