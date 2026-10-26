import type { Order } from '../../contracts/feature';
export function completeOrders(orders: readonly Order[], ids: readonly string[]): readonly Order[] {
  const selected = new Set(ids);
  if (!selected.size) throw new Error('请至少选择一笔待处理订单。');
  if (
    orders.filter((item) => selected.has(item.id) && item.status === '待处理').length !==
    selected.size
  )
    throw new Error('所选订单包含已完成或已失效记录，请重新选择。');
  return orders.map((item) => (selected.has(item.id) ? { ...item, status: '已完成' } : item));
}
