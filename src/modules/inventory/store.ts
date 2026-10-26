import { ref } from 'vue';
import { inventoryWorkspaceKey } from '../../contracts/operations';
import type { ModuleContext, StockItem } from '../../contracts/operations';
/** Demo stock balances are scoped to this app instance and reset on browser refresh. */
export function activate(context: ModuleContext): void {
  const items = ref<readonly StockItem[]>([
    {
      id: 'ST-001',
      sku: 'SKU-1001',
      name: '工业网关',
      warehouse: '上海仓',
      quantity: 120,
      reserved: 20,
      threshold: 30,
    },
    {
      id: 'ST-002',
      sku: 'SKU-1001',
      name: '工业网关',
      warehouse: '杭州仓',
      quantity: 15,
      reserved: 5,
      threshold: 20,
    },
    {
      id: 'ST-003',
      sku: 'SKU-1002',
      name: '温度传感器',
      warehouse: '上海仓',
      quantity: 360,
      reserved: 60,
      threshold: 80,
    },
    {
      id: 'ST-004',
      sku: 'SKU-1002',
      name: '温度传感器',
      warehouse: '杭州仓',
      quantity: 85,
      reserved: 10,
      threshold: 30,
    },
    {
      id: 'ST-005',
      sku: 'SKU-1003',
      name: '控制面板',
      warehouse: '上海仓',
      quantity: 8,
      reserved: 8,
      threshold: 10,
    },
    {
      id: 'ST-006',
      sku: 'SKU-1003',
      name: '控制面板',
      warehouse: '杭州仓',
      quantity: 40,
      reserved: 0,
      threshold: 10,
    },
  ]);
  context.provide(inventoryWorkspaceKey, {
    items,
    replace: (next) => {
      items.value = [...next];
    },
  });
}
