import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'media-image',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    mediaTools: [
      {
        id: 'media-image',
        order: 200,
        permission: 'mock.use',
        component: featureComponent(() => import('./Studio.vue')),
        group: 'studio',
        label: '图片创作',
      },
    ],
  },
} satisfies FeatureModule;
