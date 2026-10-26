import { activate } from './store';
import './billing.css';
import type { FeatureModule } from '../../contracts/feature';
import '../../shared/product/product.css';
export default {
  id: 'billing',
  activate,
  routes: [
    {
      name: 'billing',
      path: '/billing',
      permission: 'mock.read',
      load: () => import('./Page.vue'),
    },
  ],
  menus: [
    { id: 'billing-menu', routeName: 'billing', title: '充值与账单', permission: 'mock.read' },
  ],
  demoMemberPermissions: ['mock.read'],
} satisfies FeatureModule;
