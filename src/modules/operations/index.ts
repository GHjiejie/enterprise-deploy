import type { FeatureModule } from '../../contracts/feature';
import '../../shared/product/product.css';
export default {
  id: 'operations',
  routes: [
    {
      name: 'operations',
      path: '/operations',
      permission: 'mock.read',
      load: () => import('./Page.vue'),
    },
  ],
  menus: [
    {
      id: 'operations-menu',
      routeName: 'operations',
      title: '运维与协作',
      permission: 'mock.read',
    },
  ],
  demoMemberPermissions: ['mock.read'],
} satisfies FeatureModule;
