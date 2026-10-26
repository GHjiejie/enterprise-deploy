import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'billing-refund',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    billingRows: [
      {
        id: 'billing-refund',
        order: 120,
        permission: 'mock.use',
        component: featureComponent(() => import('./Refund.vue')),
      },
    ],
  },
} satisfies FeatureModule;
