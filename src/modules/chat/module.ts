import type { ModuleDefinition } from '../../../shared/module-definition.ts';

export const chatModule = {
  id: 'chat',
  display: { title: '智能对话', icon: '◌' },
  entryRouteName: 'chat.index',
  viewPermission: 'chat.view',
  dependsOn: [],
  navigation: { label: '智能对话', group: '在线体验', order: 20 },
  routes: [{ name: 'chat.index', path: '/chat' }],
} as const satisfies ModuleDefinition;
