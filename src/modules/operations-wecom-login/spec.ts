import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'operations-wecom-login',
  service: 'resource-wecom',
  title: '后台扫码登录',
  description: '使用企业微信安全访问管理后台。',
  button: '确认登录',
  message: '身份验证成功。',
  fields: [],
} satisfies MockActionSpec;
