import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-column-status',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'approval-column-status',
        target: 'approvals',
        title: '状态',
        order: 40,
        permission: 'column.read',
        component: defineAsyncComponent({
          loader: () => import('./Cell.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
