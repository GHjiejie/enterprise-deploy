import type { FeatureModule } from '../../contracts/feature';

import { activate } from './store';

export default {
  activate,
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
  menus: [
    {
      id: 'orders-menu',
      routeName: 'orders',
      title: '订单管理',
      guide: {
        order: 10,
        description: '从这个菜单查看订单记录，搜索订单号或客户，并按待处理、已完成筛选订单。',
      },
      permission: 'order.read',
    },
  ],
} satisfies FeatureModule;
