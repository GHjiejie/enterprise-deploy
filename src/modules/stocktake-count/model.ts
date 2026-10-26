import type { Stocktake } from '../../contracts/stocktake';
import { integer, requiredText } from '../../shared/validation';
export function countStocktake(
  document: Stocktake,
  stockId: string,
  counted: number,
  reason: string,
): Stocktake {
  if (document.status !== '盘点中') throw new Error('只有盘点中的单据可以录入实盘。');
  const line = document.lines.find((item) => item.stockId === stockId);
  if (!line) throw new Error('盘点明细已失效。');
  integer(counted, '实盘数量');
  if (counted < 0) throw new Error('实盘数量不能小于 0。');
  const normalized = counted === line.bookQuantity ? '' : requiredText(reason, '盘点差异原因', 200);
  return {
    ...document,
    lines: document.lines.map((item) =>
      item.stockId === stockId ? { ...item, counted, reason: normalized } : item,
    ),
    history: [
      ...document.history,
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        action: '录入实盘',
        comment: `${line.name}：账面 ${line.bookQuantity}，实盘 ${counted}${normalized ? `；${normalized}` : ''}`,
      },
    ],
  };
}
