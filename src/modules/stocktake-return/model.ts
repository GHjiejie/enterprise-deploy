import type { StockItem } from '../../contracts/operations';
import type { Stocktake } from '../../contracts/stocktake';
import { requiredText } from '../../shared/validation';
export function returnStocktake(
  document: Stocktake,
  items: readonly StockItem[],
  reason: string,
): Stocktake {
  if (!['待复核', '待过账'].includes(document.status))
    throw new Error('只有待复核或待过账的单据可以退回重盘。');
  const comment = requiredText(reason, '重盘原因', 200);
  const current = items.filter((item) => item.warehouse === document.warehouse);
  if (!current.length) throw new Error('盘点仓库已无库存记录，无法重盘。');
  return {
    ...document,
    status: '盘点中',
    lines: current.map((item) => ({
      stockId: item.id,
      sku: item.sku,
      name: item.name,
      bookQuantity: item.quantity,
      bookReserved: item.reserved,
      stockRevision: item.revision ?? 0,
      counted: null,
      reason: '',
    })),
    history: [
      ...document.history,
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        action: '退回重盘',
        comment: `${comment}；已更新账面快照并清空实盘数`,
      },
    ],
  };
}
