import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'operations-alert',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    operationsTools: [
      {
        id: 'operations-alert',
        order: 270,
        permission: 'mock.use',
        component: actionEntry(spec, { button: '测试通知' }),
        group: 'notifications',
      },
    ],
  },
} satisfies FeatureModule;
