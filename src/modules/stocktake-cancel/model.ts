import type { Stocktake } from '../../contracts/stocktake';
import { requiredText } from '../../shared/validation';
export function cancelStocktake(document: Stocktake, reason: string): Stocktake {
  if (['已过账', '已作废'].includes(document.status)) throw new Error('已结束的盘点单不能作废。');
  const comment = requiredText(reason, '作废原因', 200);
  return {
    ...document,
    status: '已作废',
    history: [
      ...document.history,
      { id: crypto.randomUUID(), time: new Date().toISOString(), action: '作废盘点', comment },
    ],
  };
}
