import type { FeatureModule } from '../../contracts/feature';
import './recharge.css';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'billing-recharge',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    billingTools: [
      {
        id: 'billing-recharge',
        order: 110,
        permission: 'mock.use',
        group: 'recharge',
        component: featureComponent(() => import('./Recharge.vue')),
      },
    ],
  },
} satisfies FeatureModule;
