import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'operations-alert',
  service: 'resource-feishu',
  title: '告警通知',
  description: '将服务异常与恢复消息推送到运维群。',
  button: '发送测试通知',
  message: '测试告警已发送，通知通道正常。',
  fields: [],
} satisfies MockActionSpec;
