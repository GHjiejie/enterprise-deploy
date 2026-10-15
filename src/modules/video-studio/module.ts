import type { ModuleDefinition } from '../../../shared/module-definition.ts';

export const videoStudioModule = {
  id: 'videoStudio',
  display: { title: '视频生成', icon: '▷' },
  entryRouteName: 'videoStudio.index',
  viewPermission: 'videoStudio.view',
  dependsOn: [],
  navigation: { label: '视频生成', group: '在线体验', order: 40 },
  routes: [
    {
      name: 'videoStudio.index',
      path: '/playground/video',
      aliases: ['/video-studio'],
    },
    {
      name: 'videoStudio.task',
      path: '/playground/video/tasks/:taskId',
      aliases: ['/video-studio/tasks/:taskId'],
    },
  ],
} as const satisfies ModuleDefinition;
