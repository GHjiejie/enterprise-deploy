import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-column-amount',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'approval-column-amount',
        target: 'approvals',
        title: '金额',
        order: 30,
        permission: 'column.read',
        component: defineAsyncComponent({
          loader: () => import('./Cell.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
