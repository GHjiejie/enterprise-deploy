import type { ModuleId } from '../../../shared/build-profile.ts';

export interface CatalogModel {
  readonly id: string;
  readonly name: string;
  readonly capability: 'text' | 'image' | 'video';
  readonly moduleId: ModuleId;
  readonly description: string;
  readonly tags: readonly string[];
}

// Demonstration metadata. Production catalog must use explicit server capability fields.
export const catalogModels: readonly CatalogModel[] = [
  {
    id: 'demo-text',
    name: '通用语言模型',
    capability: 'text',
    moduleId: 'chat',
    description: '理解问题、整理信息，让日常工作更轻松。',
    tags: ['智能对话', '图片理解'],
  },
  {
    id: 'demo-image',
    name: '图像创作模型',
    capability: 'image',
    moduleId: 'imageStudio',
    description: '从文字描述出发，探索构图与视觉创意。',
    tags: ['文生图', 'API 模型'],
  },
  {
    id: 'demo-video',
    name: '视频创作模型',
    capability: 'video',
    moduleId: 'videoStudio',
    description: '将创意转化为连续画面，拓展内容表达。',
    tags: ['文生视频', 'API 模型'],
  },
];
