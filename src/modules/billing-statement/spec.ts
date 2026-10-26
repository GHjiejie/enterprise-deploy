import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'billing-statement',
  service: 'resource-pay',
  title: '交易对账单',
  description: '按月导出交易明细。',
  button: '下载对账单',
  message: '对账单已生成。',
  fields: [{ key: 'month', label: '账单月份', initial: '2026-10', type: 'text' }],
  emptyMessage: '当前月份没有交易对账数据。',
} satisfies MockActionSpec;
