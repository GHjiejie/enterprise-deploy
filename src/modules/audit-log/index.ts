import type { FeatureModule } from '../../contracts/feature';
import { activate } from './store';
export default {
  id: 'audit-log',
  routes: [
    {
      name: 'audit-log',
      path: '/audit',
      permission: 'audit.read',
      load: () => import('./AuditPage.vue'),
    },
  ],
  menus: [
    {
      id: 'audit-log-menu',
      routeName: 'audit-log',
      title: '操作审计',
      guide: {
        order: 60,
        description:
          '在这里查看本次会话中的操作记录，可按业务范围或关键词筛选，追踪谁执行了什么操作。',
      },
      permission: 'audit.read',
    },
  ],
  activate,
} satisfies FeatureModule;
