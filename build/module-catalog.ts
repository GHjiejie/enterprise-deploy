import type { BuildProfile, ModuleId } from '../shared/build-profile.ts';
import type { ModuleDefinition } from '../shared/module-definition.ts';
import {
  getEnabledModules as selectEnabledModules,
  getEntryRoute,
  validateModuleAssembly as validateAssembly,
} from '../shared/module-assembly.ts';
import { chatModule } from '../src/modules/chat/module.ts';
import { imageStudioModule } from '../src/modules/image-studio/module.ts';
import { modelCatalogModule } from '../src/modules/model-catalog/module.ts';
import { videoStudioModule } from '../src/modules/video-studio/module.ts';

/** Complete Node-only catalog. Entry declarations never execute business code. */
export const moduleRegistry: readonly ModuleDefinition[] = [
  modelCatalogModule,
  chatModule,
  imageStudioModule,
  videoStudioModule,
];

export interface ModuleBuildEntry {
  readonly metadata: string;
  readonly metadataExport: string;
  readonly page: string;
  readonly activator?: string;
}

export const moduleEntries: Readonly<Record<ModuleId, ModuleBuildEntry>> = {
  modelCatalog: {
    metadata: 'src/modules/model-catalog/module.ts',
    metadataExport: 'modelCatalogModule',
    page: 'src/modules/model-catalog/page.tsx',
  },
  chat: {
    metadata: 'src/modules/chat/module.ts',
    metadataExport: 'chatModule',
    page: 'src/modules/chat/page.tsx',
  },
  imageStudio: {
    metadata: 'src/modules/image-studio/module.ts',
    metadataExport: 'imageStudioModule',
    page: 'src/modules/image-studio/page.tsx',
  },
  videoStudio: {
    metadata: 'src/modules/video-studio/module.ts',
    metadataExport: 'videoStudioModule',
    page: 'src/modules/video-studio/page.tsx',
  },
};

export { getEntryRoute };

export function getEnabledModules(
  profile: BuildProfile,
  registry: readonly ModuleDefinition[] = moduleRegistry,
): readonly ModuleDefinition[] {
  return selectEnabledModules(profile, registry);
}

export function validateModuleAssembly(
  profile: BuildProfile,
  registry: readonly ModuleDefinition[] = moduleRegistry,
): void {
  validateAssembly(profile, registry);
}
