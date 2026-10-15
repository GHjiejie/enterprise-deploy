import type { ModuleDefinition } from '../../../shared/module-definition.ts';

export const modelCatalogModule = {
  id: 'modelCatalog',
  display: { title: '模型广场', icon: '◈' },
  entryRouteName: 'modelCatalog.index',
  viewPermission: 'modelCatalog.view',
  dependsOn: [],
  navigation: { label: '模型广场', group: '模型服务', order: 10 },
  routes: [{ name: 'modelCatalog.index', path: '/models', aliases: ['/model-catalog'] }],
} as const satisfies ModuleDefinition;
