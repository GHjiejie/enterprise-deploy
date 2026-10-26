import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'account-email-bind',
  service: 'resource-smtp',
  title: '邮箱绑定',
  description: '接收业务通知与账号安全邮件。',
  button: '确认绑定',
  message: '邮箱 {{email}} 已绑定。',
  fields: [
    {
      key: 'email',
      label: '邮箱地址',
      initial: '',
      type: 'email',
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    },
    {
      key: 'code',
      label: '邮箱验证码',
      initial: '',
      type: 'text',
      pattern: '^123456$',
      hint: '演示验证码为 123456。',
    },
  ],
} satisfies MockActionSpec;
