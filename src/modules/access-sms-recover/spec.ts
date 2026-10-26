import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'access-sms-recover',
  service: 'resource-sms',
  title: '找回密码',
  description: '模拟短信验证找回密码。',
  button: '验证找回密码',
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
