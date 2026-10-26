import type { FeatureModule } from '../../contracts/feature';
import { activate } from './store';
import './media.css';
import '../../shared/product/product.css';
export default {
  id: 'media',
  activate,
  routes: [
    { name: 'media', path: '/media', permission: 'mock.read', load: () => import('./Page.vue') },
  ],
  menus: [{ id: 'media-menu', routeName: 'media', title: '文件与媒体', permission: 'mock.read' }],
  demoMemberPermissions: ['mock.read'],
} satisfies FeatureModule;
