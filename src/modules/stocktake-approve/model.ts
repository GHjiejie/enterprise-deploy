import type { Stocktake } from '../../contracts/stocktake';
export function approveStocktake(document: Stocktake, comment = ''): Stocktake {
  if (document.status !== '待复核') throw new Error('只有待复核的盘点单可以复核通过。');
  return {
    ...document,
    status: '待过账',
    history: [
      ...document.history,
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        action: '盘点复核通过',
        comment: comment || '实盘结果已复核，等待差异过账',
      },
    ],
  };
}
