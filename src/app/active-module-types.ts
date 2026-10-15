import type { ComponentType } from 'react';
import type { ModuleId } from '../../shared/build-profile.ts';
import type { ModuleDefinition } from '../../shared/module-definition.ts';
import type { ModuleActivator } from '../platform/module-lifecycle.ts';

export type PageLoader = () => Promise<{ default: ComponentType }>;
export type ActivatorLoader = () => Promise<{ activate: ModuleActivator }>;

export interface ActiveModuleAssembly {
  readonly activeRegistry: readonly ModuleDefinition[];
  readonly pageLoaders: Readonly<Partial<Record<ModuleId, PageLoader>>>;
  readonly activatorLoaders: Readonly<Partial<Record<ModuleId, ActivatorLoader>>>;
  readonly activeModuleIds: readonly ModuleId[];
}
