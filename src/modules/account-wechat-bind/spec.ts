import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'account-wechat-bind',
  service: 'resource-wechat',
  title: '微信绑定',
  description: '绑定后可使用微信扫码登录。',
  button: '确认绑定',
  message: '微信账号已绑定。',
  fields: [],
} satisfies MockActionSpec;
