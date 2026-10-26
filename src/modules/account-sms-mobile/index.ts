import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'account-sms-mobile',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    accountTools: [
      {
        id: 'account-sms-mobile',
        order: 40,
        permission: 'mock.use',
        component: actionEntry(spec, { button: '修改' }),
        group: 'security',
      },
    ],
  },
} satisfies FeatureModule;
