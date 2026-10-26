import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'operations-ticket',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    operationsTools: [
      {
        id: 'operations-ticket',
        order: 250,
        permission: 'mock.use',
        component: featureComponent(() => import('./Sync.vue')),
        group: 'support',
      },
    ],
  },
} satisfies FeatureModule;
