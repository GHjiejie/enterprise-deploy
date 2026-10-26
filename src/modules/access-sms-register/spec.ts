import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'access-sms-register',
  service: 'resource-sms',
  title: '手机注册',
  description: '模拟注册验证，不创建真实账号。',
  button: '发送注册验证码',
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
