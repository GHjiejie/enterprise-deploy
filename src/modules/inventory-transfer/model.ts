import type { StockItem } from '../../contracts/operations';
import { integer, requiredText } from '../../shared/validation';
export function transferStock(
  items: readonly StockItem[],
  sourceId: string,
  targetId: string,
  quantity: number,
  reason: string,
): readonly StockItem[] {
  integer(quantity, '调拨数量');
  requiredText(reason, '调拨原因', 200);
  if (quantity <= 0) throw new Error('调拨数量必须大于 0。');
  const source = items.find((item) => item.id === sourceId);
  const target = items.find((item) => item.id === targetId);
  if (!source || !target || source.sku !== target.sku || source.warehouse === target.warehouse)
    throw new Error('请选择同一商品的不同仓库。');
  if (quantity > source.quantity - source.reserved)
    throw new Error('调拨数量超过源仓可用库存，预留库存不可调拨。');
  integer(target.quantity + quantity, '目标仓库存');
  return items.map((item) =>
    item.id === sourceId
      ? { ...item, quantity: item.quantity - quantity, revision: (item.revision ?? 0) + 1 }
      : item.id === targetId
        ? { ...item, quantity: item.quantity + quantity, revision: (item.revision ?? 0) + 1 }
        : item,
  );
}
