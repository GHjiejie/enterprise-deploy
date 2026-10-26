import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-detail-lines',
  demoMemberPermissions: ['tab.read'],
  contributions: {
    detailTabs: [
      {
        id: 'stocktake-detail-lines',
        target: 'stocktake-detail',
        title: '盘点明细',
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
