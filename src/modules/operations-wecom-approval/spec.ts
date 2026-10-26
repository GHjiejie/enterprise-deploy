import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'operations-wecom-approval',
  service: 'resource-wecom',
  title: '后台审批',
  description: '提交业务变更，并跟踪审批进度。',
  button: '提交审批',
  message: '审批申请已提交。',
  fields: [
    { key: 'subject', label: '申请事项', initial: '', type: 'text' },
    { key: 'reason', label: '申请说明', initial: '', type: 'textarea' },
  ],
} satisfies MockActionSpec;
