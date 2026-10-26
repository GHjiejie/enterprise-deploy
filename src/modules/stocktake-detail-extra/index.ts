import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'stocktake-detail-extra',
  demoMemberPermissions: ['tab.read'],
  contributions: {
    detailTabs: [
      {
        id: 'stocktake-detail-extra',
        target: 'stocktake-detail',
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
