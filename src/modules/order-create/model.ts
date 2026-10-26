import type { FormEntry } from '../../contracts/presentation';
import type { Order } from '../../contracts/feature';
import { positiveAmount, requiredText } from '../../shared/validation';
export function createOrder(
  customer: string,
  amount: number,
  extra: readonly FormEntry[] = [],
): Order {
  return {
    id: `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    customer: requiredText(customer, '客户名称', 60),
    amount: positiveAmount(amount),
    ...(extra.length ? { extra: extra.map((entry) => ({ ...entry })) } : {}),
    status: '待处理',
  };
}
