import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'account-avatar',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    accountTools: [
      {
        id: 'account-avatar',
        order: 190,
        permission: 'mock.use',
        component: featureComponent(() => import('./Avatar.vue')),
        group: 'security',
      },
    ],
  },
} satisfies FeatureModule;
