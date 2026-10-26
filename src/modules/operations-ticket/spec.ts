import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'operations-ticket',
  service: 'resource-feishu',
  title: '同步工单',
  description: '同步最近的客户服务记录。',
  button: '同步工单',
  message: '工单已同步。',
  fields: [],
} satisfies MockActionSpec;
