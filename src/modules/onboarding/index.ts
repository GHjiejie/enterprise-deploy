import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
export default {
  id: 'onboarding',
  demoMemberPermissions: ['guide.read'],
  contributions: {
    shellTools: [
      {
        id: 'onboarding-launcher',
        order: 10,
        permission: 'guide.read',
        component: defineAsyncComponent({
          loader: () => import('./Onboarding.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
