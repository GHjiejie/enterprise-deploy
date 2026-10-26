import type { FeatureModule } from '../../contracts/feature';
import { defineAsyncComponent } from 'vue';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'inventory-transfer',
  contributions: {
    inventoryTools: [
      {
        id: 'inventory-transfer',
        order: 10,
        permission: 'inventory.transfer',
        guide: {
          routeName: 'inventory',
          title: '跨仓调拨',
          description:
            '点击这里选择源仓商品和同商品的目标仓，再填写数量与原因。调拨数量不能超过源仓可用库存。',
        },
        component: defineAsyncComponent({
          loader: () => import('./StockTransfer.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
