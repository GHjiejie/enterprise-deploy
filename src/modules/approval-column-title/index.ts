import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-column-title',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'approval-column-title',
        target: 'approvals',
        title: '申请事由',
        order: 10,
        permission: 'column.read',
        component: defineAsyncComponent({
          loader: () => import('./Cell.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
