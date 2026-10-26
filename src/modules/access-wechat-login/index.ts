import type { FeatureModule } from '../../contracts/feature';
import { featureComponent } from '../../shared/product/entry';
import '../../shared/product/auth.css';
export default {
  id: 'access-wechat-login',
  demoMemberPermissions: ['mock.use'],
  contributions: {
    accessTools: [
      {
        id: 'access-wechat-login',
        order: 90,
        permission: 'mock.use',
        component: featureComponent(() => import('./Scan.vue')),
        group: 'method',
        label: '微信扫码登录',
      },
    ],
  },
} satisfies FeatureModule;
