import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'operations-feedback',
  demoMemberPermissions: ['mock.use'],
  routes: [
    {
      name: 'operations-feedback',
      path: '/operations/feedback',
      permission: 'mock.use',
      layout: 'workspace',
      load: () => import('./Page.vue'),
    },
  ],
  contributions: {
    operationsTools: [
      {
        id: 'operations-feedback',
        order: 240,
        permission: 'mock.use',
        component: actionEntry(spec, { destination: '/operations/feedback', button: '提交反馈' }),
        group: 'support',
      },
    ],
  },
} satisfies FeatureModule;
