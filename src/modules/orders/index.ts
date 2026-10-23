import type { FeatureModule } from '../../contracts/feature';

export default {
  id: 'orders',
  demoMemberPermissions: ['order.read'],
  routes: [
    {
      name: 'orders',
      path: '/orders',
      permission: 'order.read',
      load: () => import('./OrdersPage.vue'),
    },
  ],
  menus: [{ id: 'orders-menu', routeName: 'orders', title: '订单管理', permission: 'order.read' }],
} satisfies FeatureModule;
