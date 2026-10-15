import {
  activeRegistry as generatedRegistry,
  pageLoaders as generatedPages,
  activatorLoaders as generatedActivators,
  activeModuleIds as generatedIds,
} from 'virtual:enterprise-modules';
import { MODULE_IDS } from '../../shared/build-profile.ts';
import type { ModuleId } from '../../shared/build-profile.ts';
import type { ModuleDefinition } from '../../shared/module-definition.ts';
import type { ActivatorLoader, PageLoader } from './active-module-types.ts';

// This boundary has no fallback catalog or convention-based business imports.
const idSet = new Set<ModuleId>(generatedIds);
const registryIds = generatedRegistry.map((module) => module.id);
const pageIds = Object.keys(generatedPages);
if (
  idSet.size !== generatedIds.length ||
  generatedIds.some((id) => !MODULE_IDS.includes(id)) ||
  registryIds.length !== idSet.size ||
  new Set(registryIds).size !== idSet.size ||
  registryIds.some((id) => !idSet.has(id)) ||
  pageIds.length !== idSet.size ||
  pageIds.some((id) => !idSet.has(id as ModuleId)) ||
  Object.keys(generatedActivators).some((id) => !idSet.has(id as ModuleId)) ||
  Object.values(generatedPages).some((loader) => typeof loader !== 'function') ||
  Object.values(generatedActivators).some((loader) => typeof loader !== 'function')
) {
  throw new Error('活动模块目录与加载器不一致');
}

export const activeRegistry: readonly ModuleDefinition[] = Object.freeze([...generatedRegistry]);
export const pageLoaders: Readonly<Partial<Record<ModuleId, PageLoader>>> = Object.freeze({
  ...generatedPages,
});
export const activatorLoaders: Readonly<Partial<Record<ModuleId, ActivatorLoader>>> = Object.freeze(
  {
    ...generatedActivators,
  },
);
export const activeModuleIds: readonly ModuleId[] = Object.freeze([...generatedIds]);
