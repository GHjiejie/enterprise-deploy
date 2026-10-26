import { ref } from 'vue';
import { approvalWorkspaceKey } from '../../contracts/operations';
import type { Approval, ModuleContext } from '../../contracts/operations';
export function activate(context: ModuleContext): void {
  const requests = ref<readonly Approval[]>([
    {
      id: 'AP-1001',
      title: '华东机房设备采购',
      applicant: '林晓',
      amount: 68000,
      status: '待审批',
      history: [
        {
          id: 'h-1',
          time: '2026-10-23T01:00:00.000Z',
          action: '提交申请',
          comment: '采购工业网关与控制面板',
        },
      ],
    },
    {
      id: 'AP-1002',
      title: '客户现场服务差旅',
      applicant: '陈晨',
      amount: 3200,
      status: '待审批',
      history: [
        {
          id: 'h-2',
          time: '2026-10-23T02:00:00.000Z',
          action: '提交申请',
          comment: '客户现场调试',
        },
      ],
    },
    {
      id: 'AP-1003',
      title: '研发测试环境扩容',
      applicant: '周宁',
      amount: 52000,
      status: '复核中',
      history: [
        {
          id: 'h-3',
          time: '2026-10-22T02:00:00.000Z',
          action: '提交申请',
          comment: '扩容测试设备',
        },
        {
          id: 'h-4',
          time: '2026-10-23T03:00:00.000Z',
          action: '初审通过',
          comment: '预算已确认，转复核',
        },
      ],
    },
  ]);
  context.provide(approvalWorkspaceKey, {
    requests,
    replace: (next) => {
      requests.value = [...next];
    },
  });
}
