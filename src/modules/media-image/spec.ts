import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'media-image',
  service: 'resource-oss',
  title: '图片创作',
  description: '用文字描述你想要的画面。',
  button: '生成图片',
  message: '图片已生成。',
  fields: [{ key: 'prompt', label: '画面描述', initial: '', type: 'textarea' }],
} satisfies MockActionSpec;
