import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'media-export',
  service: 'resource-oss',
  title: '导出文件',
  description: '导出当前文件列表。',
  button: '导出文件',
  message: '文件列表已导出。',
  fields: [],
} satisfies MockActionSpec;
