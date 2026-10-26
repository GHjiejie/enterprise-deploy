import type { Stocktake } from '../../contracts/stocktake';
import { integer, requiredText } from '../../shared/validation';
export function submitStocktake(document: Stocktake): Stocktake {
  if (document.status !== '盘点中') throw new Error('只有盘点中的单据可以提交复核。');
  if (!document.lines.length || document.lines.some((line) => line.counted === null))
    throw new Error('请先完成全部明细的实盘录入。');
  for (const line of document.lines) {
    if (line.counted === null || integer(line.counted, '实盘数量') < 0)
      throw new Error('实盘数量无效。');
    if (line.counted !== line.bookQuantity) requiredText(line.reason, '盘点差异原因', 200);
  }
  return {
    ...document,
    status: '待复核',
    history: [
      ...document.history,
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        action: '提交复核',
        comment: `已提交 ${document.lines.length} 项实盘记录`,
      },
    ],
  };
}
