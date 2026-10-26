import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'operations-wecom-approval',
  demoMemberPermissions: ['mock.use'],
  routes: [
    {
      name: 'operations-wecom-approval',
      path: '/operations/approval',
      permission: 'mock.use',
      layout: 'workspace',
      load: () => import('./Page.vue'),
    },
  ],
  contributions: {
    operationsTools: [
      {
        id: 'operations-wecom-approval',
        order: 140,
        permission: 'mock.use',
        component: actionEntry(spec, { destination: '/operations/approval', button: '前往审批' }),
        group: 'security',
      },
    ],
  },
} satisfies FeatureModule;
