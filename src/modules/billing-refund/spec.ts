import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'billing-refund',
  service: 'resource-pay',
  title: '申请退款',
  description: '退款将退回原支付渠道。',
  button: '确认退款',
  message: '退款申请已受理。',
  fields: [{ key: 'trade', label: '交易单号', initial: 'TX20261026001', type: 'text' }],
} satisfies MockActionSpec;
