import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'access-wechat-login',
  service: 'resource-wechat',
  title: '微信扫码登录',
  description: '使用微信扫一扫，安全登录工作台。',
  button: '我已在手机上确认',
  message: '登录成功。',
  fields: [],
} satisfies MockActionSpec;
