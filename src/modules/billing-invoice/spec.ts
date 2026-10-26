import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'billing-invoice',
  service: 'resource-oss',
  title: '查看发票',
  description: '查看与保存交易对应的电子发票。',
  button: '查看发票',
  message: '电子发票已就绪。',
  fields: [{ key: 'invoice', label: '发票单号', initial: 'INV20261026001', type: 'text' }],
  emptyMessage: '当前没有发票文件。',
} satisfies MockActionSpec;
