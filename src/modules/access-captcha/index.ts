import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
import '../../shared/product/auth.css';
export default {
  id: 'access-captcha',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    accessTools: [
      {
        id: 'access-captcha',
        order: 60,
        permission: 'mock.use',
        component: featureComponent(() => import('./Challenge.vue')),
        group: 'challenge',
      },
    ],
  },
} satisfies FeatureModule;
