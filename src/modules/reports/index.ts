import type { FeatureModule } from '../../contracts/feature';

export default {
  id: 'reports',
  routes: [
    {
      name: 'reports',
      path: '/reports',
      permission: 'report.read',
      load: () => import('./ReportsPage.vue'),
    },
  ],
  menus: [
    {
      id: 'reports-menu',
      routeName: 'reports',
      title: '经营报表',
      guide: {
        order: 50,
        description: '打开此菜单查看经营汇总、关键指标和收入趋势，用于了解整体业务表现。',
      },
      permission: 'report.read',
    },
  ],
} satisfies FeatureModule;
