import type { Order } from '../../contracts/feature';

/** Explicit demo adapter. Replace with the project's authenticated backend client. */
export async function listOrders(signal: AbortSignal): Promise<readonly Order[]> {
  signal.throwIfAborted();
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  signal.throwIfAborted();
  return [
    { id: 'ORD-2026-1001', customer: '远山科技', amount: 12800, status: '待处理' },
    { id: 'ORD-2026-1002', customer: '青禾设计', amount: 8600, status: '已完成' },
    { id: 'ORD-2026-1003', customer: '星河制造', amount: 24500, status: '待处理' },
    { id: 'ORD-2026-1004', customer: '望海贸易', amount: 6800, status: '已完成' },
    { id: 'ORD-2026-1005', customer: '知行工作室', amount: 15600, status: '已完成' },
  ];
}
