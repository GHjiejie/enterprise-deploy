import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
export default {
  id: 'account-personal-auth',
  demoMemberPermissions: ['mock.use'],
  routes: [
    {
      name: 'account-personal-auth',
      path: '/account/personal-auth',
      permission: 'mock.use',
      layout: 'workspace',
      load: () => import('./Page.vue'),
    },
  ],
  contributions: {
    accountTools: [
      {
        id: 'account-personal-auth',
        order: 70,
        permission: 'mock.use',
        component: actionEntry(spec, { destination: '/account/personal-auth', button: '去认证' }),
        group: 'identity',
      },
    ],
  },
} satisfies FeatureModule;
