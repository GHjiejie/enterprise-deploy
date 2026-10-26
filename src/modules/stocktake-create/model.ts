import type { StockItem } from '../../contracts/operations';
import type { Stocktake } from '../../contracts/stocktake';
import type { FormEntry } from '../../contracts/presentation';
import { requiredText } from '../../shared/validation';
export function createStocktake(
  documents: readonly Stocktake[],
  items: readonly StockItem[],
  title: string,
  warehouse: string,
  extra: readonly FormEntry[] = [],
): Stocktake {
  const name = requiredText(title, '盘点名称', 80);
  const selected = items.filter((item) => item.warehouse === warehouse);
  if (!selected.length) throw new Error('请选择有库存记录的盘点仓库。');
  if (
    documents.some(
      (item) => item.warehouse === warehouse && !['已过账', '已作废'].includes(item.status),
    )
  )
    throw new Error('该仓已有未结束的盘点单，请先完成或作废。');
  return {
    id: `PD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    title: name,
    warehouse,
    status: '盘点中',
    extra: [...extra],
    lines: selected.map((item) => ({
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
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        action: '创建盘点',
        comment: `固定 ${warehouse} 的 ${selected.length} 项账面快照`,
      },
    ],
  };
}
