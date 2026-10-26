import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'account-enterprise-auth',
  demoMemberPermissions: ['mock.use'],
  routes: [
    {
      name: 'account-enterprise-auth',
      path: '/account/enterprise-auth',
      permission: 'mock.use',
      layout: 'workspace',
      load: () => import('./Page.vue'),
    },
  ],
  contributions: {
    accountTools: [
      {
        id: 'account-enterprise-auth',
        order: 80,
        permission: 'mock.use',
        component: actionEntry(spec, { destination: '/account/enterprise-auth', button: '去认证' }),
        group: 'identity',
      },
    ],
  },
} satisfies FeatureModule;
