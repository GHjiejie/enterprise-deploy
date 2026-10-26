import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'account-sms-close',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    accountTools: [
      {
        id: 'account-sms-close',
        order: 50,
        permission: 'mock.use',
        component: actionEntry(spec, { button: '申请注销' }),
        group: 'security',
      },
    ],
  },
} satisfies FeatureModule;
