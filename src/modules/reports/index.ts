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
    { id: 'reports-menu', routeName: 'reports', title: '经营报表', permission: 'report.read' },
  ],
} satisfies FeatureModule;
