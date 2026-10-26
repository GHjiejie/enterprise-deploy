import type { StockItem } from '../../contracts/operations';
import { integer, requiredText } from '../../shared/validation';
export function adjustStock(
  items: readonly StockItem[],
  id: string,
  delta: number,
  reason: string,
): readonly StockItem[] {
  integer(delta, '调整数量');
  requiredText(reason, '调整原因', 200);
  if (!delta) throw new Error('调整数量不能为 0。');
  const current = items.find((item) => item.id === id);
  if (!current) throw new Error('库存记录已失效。');
  const quantity = integer(current.quantity + delta, '调整后库存');
  if (quantity < current.reserved) throw new Error('调整后库存不能低于已预留库存。');
  return items.map((item) =>
    item.id === id ? { ...item, quantity, revision: (item.revision ?? 0) + 1 } : item,
  );
}
