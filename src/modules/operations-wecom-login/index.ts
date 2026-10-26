import type { FeatureModule } from '../../contracts/feature';
import { actionEntry } from '../../shared/product/entry';
import { spec } from './spec';
import '../../shared/product/auth.css';
export default {
  id: 'operations-wecom-login',
  demoMemberPermissions: ['mock.use'],
  routes: [
    {
      name: 'operations-wecom-login',
      path: '/admin-login',
      permission: 'mock.use',
      layout: 'standalone',
      load: () => import('./Page.vue'),
    },
  ],
  contributions: {
    operationsTools: [
      {
        id: 'operations-wecom-login',
        order: 150,
        permission: 'mock.use',
        component: actionEntry(spec, { destination: '/admin-login', button: '扫码登录' }),
        group: 'security',
      },
    ],
  },
} satisfies FeatureModule;
