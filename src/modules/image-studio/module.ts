import type { ModuleDefinition } from '../../../shared/module-definition.ts';

export const imageStudioModule = {
  id: 'imageStudio',
  entryRouteName: 'imageStudio.index',
  viewPermission: 'imageStudio.view',
  dependsOn: [],
  navigation: { label: '图片生成', group: '在线体验', order: 30 },
  routes: [
    {
      name: 'imageStudio.index',
      path: '/playground/image',
      aliases: ['/image-studio'],
    },
    {
      name: 'imageStudio.task',
      path: '/playground/image/tasks/:taskId',
      aliases: ['/image-studio/tasks/:taskId'],
    },
  ],
} as const satisfies ModuleDefinition;
