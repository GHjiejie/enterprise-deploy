import type { StockItem } from '../../contracts/operations';
import type { Stocktake } from '../../contracts/stocktake';
import { integer, requiredText } from '../../shared/validation';
export function postStocktake(
  document: Stocktake,
  items: readonly StockItem[],
): { document: Stocktake; items: readonly StockItem[] } {
  if (document.status !== '待过账') throw new Error('只有复核通过的盘点单可以差异过账。');
  if (
    !document.lines.length ||
    new Set(document.lines.map((line) => line.stockId)).size !== document.lines.length
  )
    throw new Error('盘点明细无效，无法过账。');
  const warehouse = items.filter((item) => item.warehouse === document.warehouse);
  if (warehouse.length !== document.lines.length)
    throw new Error('仓库商品范围已变化，请退回重盘。');
  // Validate every line against live stock before preparing either new collection.
  for (const line of document.lines) {
    const current = items.find((item) => item.id === line.stockId);
    if (
      !current ||
      current.warehouse !== document.warehouse ||
      current.sku !== line.sku ||
      current.quantity !== line.bookQuantity ||
      current.reserved !== line.bookReserved ||
      (current.revision ?? 0) !== line.stockRevision
    )
      throw new Error(`${line.name} 的库存已变化，请退回重盘后再过账。`);
    if (line.counted === null || integer(line.counted, '实盘数量') < 0)
      throw new Error('盘点明细尚未完成，无法过账。');
    if (line.counted < current.reserved)
      throw new Error(`${line.name} 的实盘数低于预留库存，无法过账。`);
    if (line.counted !== line.bookQuantity) requiredText(line.reason, '盘点差异原因', 200);
  }
  const quantities = new Map(document.lines.map((line) => [line.stockId, line.counted]));
  const next = items.map((item) => {
    const counted = quantities.get(item.id);
    return counted === undefined || counted === null
      ? item
      : { ...item, quantity: counted, revision: (item.revision ?? 0) + 1 };
  });
  const delta = document.lines.reduce(
    (sum, line) => sum + (line.counted ?? line.bookQuantity) - line.bookQuantity,
    0,
  );
  return {
    items: next,
    document: {
      ...document,
      status: '已过账',
      history: [
        ...document.history,
        {
          id: crypto.randomUUID(),
          time: new Date().toISOString(),
          action: '差异过账',
          comment: `已一次更新 ${document.lines.length} 项库存，净差异 ${delta > 0 ? '+' : ''}${delta} 件`,
        },
      ],
    },
  };
}
