import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'operations-email-notify',
  service: 'resource-smtp',
  title: '邮件通知',
  description: '向团队成员发送业务通知。',
  button: '发送通知',
  message: '通知已发送至 {{email}}。',
  fields: [
    {
      key: 'email',
      label: '收件邮箱',
      initial: '',
      type: 'email',
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    },
    { key: 'subject', label: '邮件主题', initial: '', type: 'text' },
    { key: 'body', label: '邮件内容', initial: '', type: 'textarea' },
  ],
} satisfies MockActionSpec;
