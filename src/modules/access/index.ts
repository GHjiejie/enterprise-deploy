import '../../shared/product/auth.css';
import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
import '../../shared/product/product.css';
export default {
  id: 'access',
  routes: [
    {
      name: 'access',
      path: '/access',
      permission: 'mock.read',
      layout: 'standalone',
      load: () => import('./Page.vue'),
    },
  ],
  contributions: {
    shellTools: [
      {
        id: 'access-session',
        order: 100,
        permission: 'mock.read',
        component: featureComponent(() => import('./SessionLink.vue')),
      },
    ],
  },
  demoMemberPermissions: ['mock.read'],
} satisfies FeatureModule;
