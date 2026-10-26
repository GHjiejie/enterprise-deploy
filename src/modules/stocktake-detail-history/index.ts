import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-detail-history',
  demoMemberPermissions: ['tab.read'],
  contributions: {
    detailTabs: [
      {
        id: 'stocktake-detail-history',
        target: 'stocktake-detail',
        title: '流转记录',
        order: 20,
        permission: 'tab.read',
        component: defineAsyncComponent({
          loader: () => import('./Panel.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
