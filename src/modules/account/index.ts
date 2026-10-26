import type { FeatureModule } from '../../contracts/feature';
import '../../shared/product/product.css';
export default {
  id: 'account',
  routes: [
    {
      name: 'account',
      path: '/account',
      permission: 'mock.read',
      load: () => import('./Page.vue'),
    },
  ],
  menus: [
    { id: 'account-menu', routeName: 'account', title: '账号与认证', permission: 'mock.read' },
  ],
  demoMemberPermissions: ['mock.read'],
} satisfies FeatureModule;
