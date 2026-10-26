import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'operations-hermes-chat',
  service: 'resource-feishu',
  title: '运维指令通道',
  description: '通过飞书向运维团队发送指令。',
  button: '发送指令',
  message: '指令已发送，服务运行状态正常。',
  fields: [{ key: 'command', label: '运维指令', initial: '', type: 'textarea' }],
} satisfies MockActionSpec;
