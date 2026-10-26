import type { FeatureModule } from '../../contracts/feature';

import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-column-applicant',
  demoMemberPermissions: ['column.read'],
  contributions: {
    columns: [
      {
        id: 'approval-column-applicant',
        target: 'approvals',
        title: '申请人',
        order: 20,
        permission: 'column.read',
        component: defineAsyncComponent({
          loader: () => import('./Cell.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
