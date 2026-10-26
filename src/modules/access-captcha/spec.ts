import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'access-captcha',
  service: 'resource-captcha',
  title: '安全验证',
  description: '请完成安全验证。',
  button: '点击完成安全验证',
  message: '安全验证已通过。',
  fields: [],
} satisfies MockActionSpec;
