import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'operations-feedback',
  service: 'resource-feishu',
  title: '意见反馈',
  description: '告诉我们遇到的问题或改进建议。',
  button: '提交反馈',
  message: '感谢你的反馈，我们会尽快处理。',
  fields: [
    { key: 'type', label: '反馈类型', initial: '产品建议', type: 'text' },
    { key: 'content', label: '问题描述', initial: '', type: 'textarea' },
    {
      key: 'contact',
      label: '联系邮箱',
      initial: '',
      type: 'email',
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    },
  ],
} satisfies MockActionSpec;
