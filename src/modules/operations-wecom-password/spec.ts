import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'operations-wecom-password',
  service: 'resource-wecom',
  title: '修改管理密码',
  description: '通过二次验证后更新管理密码。',
  button: '确认修改',
  message: '管理密码已更新。',
  fields: [
    { key: 'current', label: '当前密码', initial: '', type: 'password' },
    {
      key: 'password',
      label: '新密码',
      initial: '',
      type: 'password',
      pattern: '^.{8,}$',
      hint: '新密码至少 8 位。',
    },
    {
      key: 'code',
      label: '二次验证码',
      initial: '',
      type: 'text',
      pattern: '^654321$',
      hint: '演示二次验证码为 654321。',
    },
  ],
} satisfies MockActionSpec;
