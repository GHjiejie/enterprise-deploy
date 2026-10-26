import type { FeatureModule } from '../../contracts/feature';
import { activate } from './store';
export default {
  id: 'approvals',
  demoMemberPermissions: ['approval.read'],
  routes: [
    {
      name: 'approvals',
      path: '/approvals',
      permission: 'approval.read',
      load: () => import('./ApprovalsPage.vue'),
    },
  ],
  menus: [
    {
      id: 'approvals-menu',
      routeName: 'approvals',
      title: '审批中心',
      guide: {
        order: 40,
        description: '在这里查看申请列表，按状态和金额筛选，跟踪申请当前的处理进度。',
      },
      permission: 'approval.read',
    },
  ],
  activate,
} satisfies FeatureModule;
