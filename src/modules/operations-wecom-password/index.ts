import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'operations-wecom-password',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    operationsTools: [
      {
        id: 'operations-wecom-password',
        order: 160,
        permission: 'mock.use',
        component: actionEntry(spec, { button: '修改密码' }),
        group: 'security',
      },
    ],
  },
} satisfies FeatureModule;
