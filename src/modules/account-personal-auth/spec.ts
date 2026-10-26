import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'account-personal-auth',
  service: 'resource-cloudauth',
  title: '个人实名',
  description: '完成个人实名认证，完善账号身份信息。',
  button: '提交实名认证',
  message: '个人实名认证已通过。',
  fields: [
    { key: 'name', label: '真实姓名', initial: '', type: 'text' },
    {
      key: 'identity',
      label: '身份证号码',
      initial: '',
      type: 'text',
      pattern: '^(?:[0-9]{17}[0-9Xx])$',
      hint: '请输入 18 位身份证号码。',
    },
  ],
} satisfies MockActionSpec;
