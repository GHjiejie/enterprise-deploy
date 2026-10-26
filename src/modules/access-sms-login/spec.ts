import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'access-sms-login',
  service: 'resource-sms',
  title: '短信登录',
  description: '使用演示手机号码获取短信验证码。',
  button: '发送登录验证码',
  message: '身份验证已通过。',
  fields: [
    {
      key: 'phone',
      label: '手机号码',
      initial: '',
      type: 'tel',
      pattern: '^1[0-9]{10}$',
      hint: '请输入 11 位手机号码。',
    },
  ],
} satisfies MockActionSpec;
