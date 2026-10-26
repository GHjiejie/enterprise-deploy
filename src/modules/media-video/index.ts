import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'media-video',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    mediaTools: [
      {
        id: 'media-video',
        order: 210,
        permission: 'mock.use',
        component: featureComponent(() => import('./Studio.vue')),
        group: 'studio',
        label: '视频创作',
      },
    ],
  },
} satisfies FeatureModule;
