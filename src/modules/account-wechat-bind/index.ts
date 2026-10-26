import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'account-wechat-bind',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    accountTools: [
      {
        id: 'account-wechat-bind',
        order: 100,
        permission: 'mock.use',
        component: featureComponent(() => import('./Binding.vue')),
        group: 'security',
      },
    ],
  },
} satisfies FeatureModule;
