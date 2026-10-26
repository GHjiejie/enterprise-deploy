import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'operations-model',
  service: 'resource-hermes',
  title: '智能运维助手',
  description: '查询服务状态，分析异常并获得处理建议。',
  button: '发送',
  message:
    '当前服务运行正常。过去 24 小时请求成功率为 99.98%，平均响应时间为 128ms。建议持续关注高峰时段的延迟变化。',
  fields: [{ key: 'question', label: '你的问题', initial: '', type: 'textarea' }],
} satisfies MockActionSpec;
