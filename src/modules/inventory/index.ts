import type { FeatureModule } from '../../contracts/feature';
import { activate } from './store';
export default {
  id: 'inventory',
  demoMemberPermissions: ['inventory.read'],
  routes: [
    {
      name: 'inventory',
      path: '/inventory',
      permission: 'inventory.read',
      load: () => import('./InventoryPage.vue'),
    },
  ],
  menus: [
    {
      id: 'inventory-menu',
      routeName: 'inventory',
      title: '库存管理',
      guide: {
        order: 20,
        description:
          '在这里按仓库查询商品库存，查看库存汇总，并使用仓库和预警条件定位需要关注的商品。',
      },
      permission: 'inventory.read',
    },
  ],
  activate,
} satisfies FeatureModule;
