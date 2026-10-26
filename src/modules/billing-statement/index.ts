import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'billing-statement',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    billingTools: [
      {
        id: 'billing-statement',
        order: 130,
        permission: 'mock.use',
        group: 'statement',
        component: featureComponent(() => import('./Statement.vue')),
      },
    ],
  },
} satisfies FeatureModule;
