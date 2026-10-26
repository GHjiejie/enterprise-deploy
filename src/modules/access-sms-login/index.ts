import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
import '../../shared/product/auth.css';
export default {
  id: 'access-sms-login',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    accessTools: [
      {
        id: 'access-sms-login',
        order: 10,
        permission: 'mock.use',
        component: featureComponent(() => import('./LoginForm.vue')),
        group: 'method',
        label: '手机验证码登录',
      },
    ],
  },
} satisfies FeatureModule;
