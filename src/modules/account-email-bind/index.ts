import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'account-email-bind',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    accountTools: [
      {
        id: 'account-email-bind',
        order: 180,
        permission: 'mock.use',
        component: actionEntry(spec, { button: '绑定' }),
        group: 'security',
      },
    ],
  },
} satisfies FeatureModule;
