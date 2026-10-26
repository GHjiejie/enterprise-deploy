import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'media-export',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    mediaTools: [
      {
        id: 'media-export',
        order: 220,
        permission: 'mock.use',
        component: featureComponent(() => import('./Export.vue')),
        group: 'toolbar',
      },
    ],
  },
} satisfies FeatureModule;
