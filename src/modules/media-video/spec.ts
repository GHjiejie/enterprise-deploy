import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'media-video',
  service: 'resource-oss',
  title: '视频创作',
  description: '将一个想法变成动态画面。',
  button: '生成视频',
  message: '视频已生成。',
  fields: [{ key: 'prompt', label: '视频描述', initial: '', type: 'textarea' }],
} satisfies MockActionSpec;
