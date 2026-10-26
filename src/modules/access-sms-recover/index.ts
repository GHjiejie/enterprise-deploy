import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
import '../../shared/product/auth.css';
export default {
  id: 'access-sms-recover',
  demoMemberPermissions: ['mock.use'],
  routes: [
    {
      name: 'access-sms-recover',
      path: '/forgot-password',
      permission: 'mock.use',
      layout: 'standalone',
      load: () => import('./RecoverPage.vue'),
    },
  ],
  contributions: {
    accessTools: [
      {
        id: 'access-sms-recover',
        order: 30,
        permission: 'mock.use',
        component: featureComponent(() => import('./Entry.vue')),
        group: 'links',
      },
    ],
  },
} satisfies FeatureModule;
