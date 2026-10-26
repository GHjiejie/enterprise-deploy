import { ref } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import type { Stocktake } from '../../contracts/stocktake';
import { stocktakeWorkspaceKey } from '../../contracts/stocktake';
export default {
  id: 'stocktakes',
  demoMemberPermissions: ['stocktake.read'],
  routes: [
    {
      name: 'stocktakes',
      path: '/stocktakes',
      permission: 'stocktake.read',
      load: () => import('./StocktakesPage.vue'),
    },
  ],
  menus: [
    {
      id: 'stocktakes-menu',
      routeName: 'stocktakes',
      title: '库存盘点',
      guide: {
        order: 30,
        description: '从这里查看盘点单、盘点进度和处理状态。盘点记录按仓库组织，方便跟踪每次盘点。',
      },
      permission: 'stocktake.read',
    },
  ],
  activate(context) {
    const documents = ref<readonly Stocktake[]>([]);
    context.provide(stocktakeWorkspaceKey, {
      documents,
      replace: (next) => {
        documents.value = [...next];
      },
    });
  },
} satisfies FeatureModule;
