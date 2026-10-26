import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'operations-email-notify',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    operationsTools: [
      {
        id: 'operations-email-notify',
        order: 170,
        permission: 'mock.use',
        component: actionEntry(spec, { button: '发送通知' }),
        group: 'notifications',
      },
    ],
  },
} satisfies FeatureModule;
