import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'operations-hermes-chat',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    operationsTools: [
      {
        id: 'operations-hermes-chat',
        order: 260,
        permission: 'mock.use',
        component: actionEntry(spec, { button: '发送指令' }),
        group: 'notifications',
      },
    ],
  },
} satisfies FeatureModule;
