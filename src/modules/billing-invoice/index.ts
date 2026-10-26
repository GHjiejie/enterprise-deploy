import type { FeatureModule } from '../../contracts/feature';
import './invoice.css';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'billing-invoice',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    billingRows: [
      {
        id: 'billing-invoice',
        order: 230,
        permission: 'mock.use',
        component: featureComponent(() => import('./Invoice.vue')),
      },
    ],
  },
} satisfies FeatureModule;
