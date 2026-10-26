import type { FeatureModule } from '../../contracts/feature';
import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'approval-submit',
  demoMemberPermissions: ['approval.submit'],
  contributions: {
    approvalTools: [
      {
        id: 'approval-submit',
        order: 10,
        permission: 'approval.submit',
        guide: {
          routeName: 'approvals',
          title: '发起审批申请',
          description:
            '点击这里填写申请信息并提交。表单内容按当前企业配置展示，提交后可以在列表中跟踪申请状态。',
        },
        component: defineAsyncComponent({
          loader: () => import('./ApprovalSubmit.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
