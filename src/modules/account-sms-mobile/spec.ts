import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'account-sms-mobile',
  service: 'resource-sms',
  title: '绑定手机',
  description: '用于接收账号安全通知与身份验证。',
  button: '保存手机号码',
  message: '手机号码已更新。',
  fields: [
    {
      key: 'phone',
      label: '新手机号码',
      initial: '',
      type: 'tel',
      pattern: '^1[0-9]{10}$',
      hint: '请输入 11 位手机号码。',
    },
    {
      key: 'code',
      label: '短信验证码',
      initial: '',
      type: 'text',
      pattern: '^123456$',
      hint: '演示验证码为 123456。',
    },
  ],
} satisfies MockActionSpec;
