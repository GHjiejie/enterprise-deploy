import type { Order } from '../../contracts/feature';

/** Demo adapter. A real export endpoint must enforce tenant and user authorization. */
export async function prepareExport(
  orders: readonly Order[],
  signal: AbortSignal,
): Promise<readonly Order[]> {
  signal.throwIfAborted();
  if (!orders.length) throw new Error('请先选择订单');
  return orders.map((order) => ({ ...order }));
}
