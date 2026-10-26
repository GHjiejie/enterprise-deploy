import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
import '../../shared/product/auth.css';
export default {
  id: 'access-sms-register',
  demoMemberPermissions: ['mock.use'],
  routes: [
    {
      name: 'access-sms-register',
      path: '/register',
      permission: 'mock.use',
      layout: 'standalone',
      load: () => import('./RegisterPage.vue'),
    },
  ],
  contributions: {
    accessTools: [
      {
        id: 'access-sms-register',
        order: 20,
        permission: 'mock.use',
        component: featureComponent(() => import('./Entry.vue')),
        group: 'links',
      },
    ],
  },
} satisfies FeatureModule;
