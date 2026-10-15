import { MODULE_IDS, type BuildProfile, type ModuleId } from '../../shared/build-profile.ts';
import type { ModuleDefinition, ModuleRoute } from '../../shared/module-definition.ts';
import { chatModule } from '../modules/chat/module.ts';
import { imageStudioModule } from '../modules/image-studio/module.ts';
import { modelCatalogModule } from '../modules/model-catalog/module.ts';
import { videoStudioModule } from '../modules/video-studio/module.ts';

/** Metadata only: importing this registry never imports pages or starts requests. */
export const moduleRegistry: readonly ModuleDefinition[] = [
  modelCatalogModule,
  chatModule,
  imageStudioModule,
  videoStudioModule,
];

export function getEnabledModules(
  profile: BuildProfile,
  registry: readonly ModuleDefinition[] = moduleRegistry,
): readonly ModuleDefinition[] {
  return registry.filter((module) => profile.modules[module.id] === true);
}

export function getEntryRoute(module: ModuleDefinition): ModuleRoute | undefined {
  return module.routes.find((route) => route.name === module.entryRouteName);
}

export function validateModuleAssembly(
  profile: BuildProfile,
  registry: readonly ModuleDefinition[] = moduleRegistry,
): void {
  const knownIds = new Set<ModuleId>(MODULE_IDS);
  const registeredIds = new Set<ModuleId>();
  const routeNames = new Set<string>();
  const routePatterns = new Set<string>();

  for (const module of registry) {
    if (!knownIds.has(module.id) || registeredIds.has(module.id)) {
      throw new Error(`未知或重复的模块注册：${module.id}`);
    }
    registeredIds.add(module.id);
    if (!module.viewPermission.trim()) {
      throw new Error(`模块 ${module.id} 缺少页面权限标识`);
    }
    for (const route of module.routes) {
      if (!route.name || routeNames.has(route.name)) {
        throw new Error(`路由名称缺失或重复：${route.name}`);
      }
      routeNames.add(route.name);
      for (const path of [route.path, ...(route.aliases ?? [])]) {
        // Canonical route shapes are unique, including differently named params.
        const pattern = path.replace(/:[^/]+/g, ':param').replace(/\/+$/, '') || '/';
        if (
          !path.startsWith('/') ||
          path.startsWith('//') ||
          path === '/' ||
          /[?#]/.test(path) ||
          routePatterns.has(pattern)
        ) {
          throw new Error(`路由路径无效或重复：${path}`);
        }
        routePatterns.add(pattern);
      }
    }
    for (const dependency of module.dependsOn) {
      if (!knownIds.has(dependency) || dependency === module.id) {
        throw new Error(`模块 ${module.id} 的依赖无效：${dependency}`);
      }
    }
  }

  for (const id of MODULE_IDS) {
    if (profile.modules[id] && !registeredIds.has(id)) {
      throw new Error(`已启用模块未注册：${id}`);
    }
  }

  const enabledModules = getEnabledModules(profile, registry);
  for (const module of enabledModules) {
    const entry = getEntryRoute(module);
    if (!entry || /[:*]/.test(entry.path)) {
      throw new Error(`模块 ${module.id} 缺少可直接跳转的入口路由`);
    }
    for (const dependency of module.dependsOn) {
      if (!profile.modules[dependency] || !registeredIds.has(dependency)) {
        throw new Error(`模块 ${module.id} 依赖未启用模块：${dependency}`);
      }
    }
  }

  const defaultModule = enabledModules.find((module) => module.id === profile.defaultModule);
  if (!defaultModule || !getEntryRoute(defaultModule)) {
    throw new Error('defaultModule 必须指向已启用且存在入口路由的模块');
  }
}
