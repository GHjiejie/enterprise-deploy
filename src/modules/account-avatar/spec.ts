import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'account-avatar',
  service: 'resource-oss',
  title: '头像',
  description: '设置一张容易识别的个人头像。',
  button: '保存头像',
  message: '头像已更新。',
  fields: [{ key: 'file', label: '头像文件', initial: '', type: 'text' }],
} satisfies MockActionSpec;
