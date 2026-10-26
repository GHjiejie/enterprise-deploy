import { defineAsyncComponent } from 'vue';
import type { FeatureModule } from '../../contracts/feature';
import ChunkError from '../../core/ChunkError.vue';
import './company.css';

export default {
  id: 'company',
  routes: [
    {
      name: 'company',
      path: '/company',
      permission: 'company.read',
      load: () => import('./CompanyPage.vue'),
    },
  ],
  menus: [
    { id: 'company-menu', routeName: 'company', title: '主体与品牌', permission: 'company.read' },
  ],
  demoMemberPermissions: ['company.read'],
  contributions: {
    shellFooter: [
      {
        id: 'company-footer',
        order: 10,
        permission: 'company.read',
        component: defineAsyncComponent({
          loader: () => import('./Footer.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
    accessBrand: [
      {
        id: 'company-login',
        order: 10,
        permission: 'company.read',
        component: defineAsyncComponent({
          loader: () => import('./LoginBrand.vue'),
          errorComponent: ChunkError,
        }),
      },
    ],
  },
} satisfies FeatureModule;
