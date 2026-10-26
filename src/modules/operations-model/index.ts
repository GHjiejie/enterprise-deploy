import './assistant.css';
import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
export default {
  id: 'operations-model',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    operationsTools: [
      {
        id: 'operations-model',
        order: 280,
        permission: 'mock.use',
        component: featureComponent(() => import('./Assistant.vue')),
        group: 'assistant',
      },
    ],
  },
} satisfies FeatureModule;
