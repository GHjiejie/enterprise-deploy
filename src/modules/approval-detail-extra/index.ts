import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-detail-extra',
  contributions: {
    detailTabs: [
      {
        id: 'approval-detail-extra',
        target: 'approval-detail',
        title: '扩展信息',
        order: 30,
        permission: 'tab.read',
        component: defineAsyncComponent({
          loader: () => import('./Panel.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
