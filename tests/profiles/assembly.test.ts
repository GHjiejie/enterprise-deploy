import { describe, expect, it, vi } from 'vitest';
import { loadBuildProfile } from '../../build/load-profile.ts';
import type { BuildProfile, ModuleId } from '../../shared/build-profile.ts';
import type { ModuleDefinition } from '../../shared/module-definition.ts';
import {
  getEnabledModules,
  moduleRegistry,
  validateModuleAssembly,
} from '../../build/module-catalog.ts';
import { getNavigation } from '../../src/app/navigation.ts';
import { resolveAppRoute } from '../../src/app/router.ts';
import { activateModules } from '../../src/platform/module-lifecycle.ts';
import {
  filterModuleLinks,
  getModuleHref,
  resolveModuleLink,
} from '../../src/platform/navigation-service.ts';
import { canViewModule, DEMO_ACCESS } from '../../src/platform/permissions.ts';

vi.mock('../../src/app/active-modules.ts', () => ({
  activeModuleIds: ['modelCatalog', 'chat'],
  pageLoaders: {
    modelCatalog: () => Promise.resolve({ default: () => null }),
    chat: () => Promise.resolve({ default: () => null }),
  },
}));

const enterpriseA = loadBuildProfile('enterprise-a');
const enterpriseB = loadBuildProfile('enterprise-b');

describe('injected build feature query', () => {
  it('uses the injected profile and keeps its module composition immutable', async () => {
    vi.stubGlobal('__BUILD_PROFILE__', enterpriseA);
    try {
      const features = await import('../../src/platform/features.ts');
      expect(features.buildProfile.id).toBe('enterprise-a');
      expect(features.isModuleEnabled('chat')).toBe(true);
      expect(features.isModuleEnabled('imageStudio')).toBe(false);
      expect(Reflect.set(features.buildProfile.modules, 'imageStudio', true)).toBe(false);
      expect(features.isModuleEnabled('imageStudio')).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function changeModule(
  id: ModuleId,
  changes: Partial<ModuleDefinition>,
): readonly ModuleDefinition[] {
  return moduleRegistry.map((module) => (module.id === id ? { ...module, ...changes } : module));
}

describe('module assembly validation', () => {
  it.each(['standard', 'enterprise-a', 'enterprise-b', 'qianshi'])(
    'validates the supported %s profile',
    (id) => {
      expect(() => validateModuleAssembly(loadBuildProfile(id))).not.toThrow();
    },
  );

  it('assembles exactly the explicit enabled module set', () => {
    expect(getEnabledModules(enterpriseA).map((module) => module.id)).toEqual([
      'modelCatalog',
      'chat',
    ]);
    expect(getEnabledModules(enterpriseB).map((module) => module.id)).toEqual([
      'modelCatalog',
      'chat',
      'imageStudio',
      'videoStudio',
    ]);
  });

  it('rejects an enabled module whose necessary dependency is disabled', () => {
    const registry = changeModule('chat', { dependsOn: ['imageStudio'] });
    expect(() => validateModuleAssembly(enterpriseA, registry)).toThrow(/依赖未启用/);
    expect(() => validateModuleAssembly(enterpriseB, registry)).not.toThrow();
  });

  it('rejects a disabled default entry, even when other entries are valid', () => {
    expect(() => validateModuleAssembly({ ...enterpriseA, defaultModule: 'imageStudio' })).toThrow(
      /defaultModule/,
    );
  });

  it('rejects missing registered modules, missing entry routes and dynamic entry paths', () => {
    expect(() =>
      validateModuleAssembly(
        enterpriseB,
        moduleRegistry.filter((module) => module.id !== 'videoStudio'),
      ),
    ).toThrow(/已启用模块未注册/);
    expect(() =>
      validateModuleAssembly(enterpriseA, changeModule('chat', { entryRouteName: 'missing' })),
    ).toThrow(/入口路由/);
    expect(() =>
      validateModuleAssembly(
        enterpriseB,
        changeModule('imageStudio', { entryRouteName: 'imageStudio.task' }),
      ),
    ).toThrow(/入口路由/);
  });

  it('rejects duplicate module IDs and ambiguous routes across modules or aliases', () => {
    const first = moduleRegistry[0];
    if (!first) throw new Error('Missing test module');
    expect(() => validateModuleAssembly(enterpriseA, [...moduleRegistry, first])).toThrow(
      /重复的模块/,
    );
    expect(() =>
      validateModuleAssembly(
        enterpriseA,
        changeModule('chat', {
          routes: [{ name: 'chat.index', path: '/models' }],
        }),
      ),
    ).toThrow(/路由路径无效或重复/);
    expect(() =>
      validateModuleAssembly(
        enterpriseB,
        changeModule('chat', {
          routes: [
            { name: 'chat.index', path: '/chat', aliases: ['/image-studio/tasks/:anotherId'] },
          ],
        }),
      ),
    ).toThrow(/路由路径无效或重复/);
  });

  it('rejects duplicate route names and invalid dependency declarations', () => {
    expect(() =>
      validateModuleAssembly(
        enterpriseB,
        changeModule('chat', {
          routes: [{ name: 'modelCatalog.index', path: '/chat' }],
        }),
      ),
    ).toThrow(/路由名称/);
    expect(() =>
      validateModuleAssembly(enterpriseB, changeModule('chat', { dependsOn: ['chat'] })),
    ).toThrow(/依赖无效/);
  });
});

describe('route guard before page loading', () => {
  it.each([
    '/playground/image',
    '/playground/image/tasks/task-1',
    '/image-studio',
    '/image-studio/tasks/task-1',
    '/playground/video',
    '/playground/video/tasks/task-1',
    '/video-studio',
    '/video-studio/tasks/task-1',
  ])('never resolves the disabled %s route, including for an administrator', (path) => {
    expect(resolveAppRoute(path, enterpriseA, DEMO_ACCESS.admin, moduleRegistry)).toEqual({
      kind: 'not-found',
    });
  });

  it.each([
    ['/models', 'modelCatalog', 'modelCatalog.index'],
    ['/chat', 'chat', 'chat.index'],
    ['/playground/image', 'imageStudio', 'imageStudio.index'],
    ['/playground/video', 'videoStudio', 'videoStudio.index'],
  ])('resolves an enabled canonical route %s', (path, moduleId, routeName) => {
    expect(resolveAppRoute(path, enterpriseB, DEMO_ACCESS.member, moduleRegistry)).toEqual({
      kind: 'page',
      moduleId,
      routeName,
      params: {},
    });
  });

  it.each(['image', 'video'])('resolves enabled %s detail parameters', (type) => {
    expect(
      resolveAppRoute(
        `/playground/${type}/tasks/task-42?tab=result#preview`,
        enterpriseB,
        DEMO_ACCESS.member,
        moduleRegistry,
      ),
    ).toEqual({
      kind: 'page',
      moduleId: `${type}Studio`,
      routeName: `${type}Studio.task`,
      params: { taskId: 'task-42' },
    });
  });

  it('preserves encoded detail IDs when normalizing legacy links', () => {
    expect(
      resolveAppRoute(
        '/image-studio/tasks/a%20b%2Fc',
        enterpriseB,
        DEMO_ACCESS.member,
        moduleRegistry,
      ),
    ).toEqual({ kind: 'redirect', to: '/playground/image/tasks/a%20b%2Fc' });
    expect(
      resolveAppRoute(
        '/playground/image/tasks/a%20b%2Fc',
        enterpriseB,
        DEMO_ACCESS.member,
        moduleRegistry,
      ),
    ).toEqual({
      kind: 'page',
      moduleId: 'imageStudio',
      routeName: 'imageStudio.task',
      params: { taskId: 'a b/c' },
    });
    expect(
      resolveAppRoute(
        '/playground/image/tasks/%invalid',
        enterpriseB,
        DEMO_ACCESS.member,
        moduleRegistry,
      ),
    ).toEqual({ kind: 'not-found' });
  });

  it.each([
    ['/model-catalog', '/models'],
    ['/image-studio', '/playground/image'],
    ['/image-studio/tasks/123', '/playground/image/tasks/123'],
    ['/video-studio', '/playground/video'],
    ['/video-studio/tasks/123', '/playground/video/tasks/123'],
    ['/playground/chat', '/chat'],
  ])('redirects guarded legacy route %s to its canonical entry', (path, to) => {
    expect(resolveAppRoute(path, enterpriseB, DEMO_ACCESS.member, moduleRegistry)).toEqual({
      kind: 'redirect',
      to,
    });
  });

  it.each([
    '/playground/unknown',
    '/playground/image/unknown',
    '/playground/image/tasks',
    '/playground/video/tasks/123/more',
    '/image-studio-extra',
    '/chat/history',
    '//external.test/models',
    'https://external.test/models',
  ])('does not use prefix matching or an unguarded generic fallback for %s', (path) => {
    expect(resolveAppRoute(path, enterpriseB, DEMO_ACCESS.admin, moduleRegistry)).toEqual({
      kind: 'not-found',
    });
  });

  it('separates anonymous and forbidden enabled routes from disabled routes', () => {
    expect(resolveAppRoute('/chat', enterpriseA, DEMO_ACCESS.anonymous, moduleRegistry)).toEqual({
      kind: 'unauthenticated',
    });
    expect(resolveAppRoute('/models', enterpriseB, DEMO_ACCESS.chatOnly, moduleRegistry)).toEqual({
      kind: 'forbidden',
    });
    expect(
      resolveAppRoute('/image-studio/tasks/1', enterpriseB, DEMO_ACCESS.chatOnly, moduleRegistry),
    ).toEqual({
      kind: 'forbidden',
    });
    expect(
      resolveAppRoute('/playground/chat', enterpriseB, DEMO_ACCESS.noAccess, moduleRegistry),
    ).toEqual({
      kind: 'forbidden',
    });
    expect(
      resolveAppRoute('/image-studio', enterpriseA, DEMO_ACCESS.anonymous, moduleRegistry),
    ).toEqual({
      kind: 'not-found',
    });
  });

  it('selects the configured default then an enabled entry permitted to the current user', () => {
    expect(resolveAppRoute('/', enterpriseA, DEMO_ACCESS.admin, moduleRegistry)).toEqual({
      kind: 'redirect',
      to: '/models',
    });
    expect(resolveAppRoute('/', enterpriseA, DEMO_ACCESS.chatOnly, moduleRegistry)).toEqual({
      kind: 'redirect',
      to: '/chat',
    });
    expect(resolveAppRoute('/', enterpriseA, DEMO_ACCESS.noAccess, moduleRegistry)).toEqual({
      kind: 'no-access',
    });
    expect(resolveAppRoute('/', enterpriseA, DEMO_ACCESS.anonymous, moduleRegistry)).toEqual({
      kind: 'unauthenticated',
    });
  });

  it('keeps menu-less modules routable and eligible for the default entry', () => {
    const catalog = moduleRegistry.find((module) => module.id === 'modelCatalog');
    if (!catalog) throw new Error('Missing test module');
    const menuLess: ModuleDefinition = {
      id: catalog.id,
      display: catalog.display,
      routes: catalog.routes,
      entryRouteName: catalog.entryRouteName,
      viewPermission: catalog.viewPermission,
      dependsOn: catalog.dependsOn,
    };
    const registry = [menuLess, ...moduleRegistry.filter((module) => module.id !== menuLess.id)];
    expect(() => validateModuleAssembly(enterpriseA, registry)).not.toThrow();
    expect(
      getNavigation(enterpriseA, DEMO_ACCESS.admin, registry)
        .flatMap((group) => group.items)
        .map((item) => item.moduleId),
    ).toEqual(['chat']);
    expect(resolveAppRoute('/models', enterpriseA, DEMO_ACCESS.admin, registry).kind).toBe('page');
    expect(resolveAppRoute('/', enterpriseA, DEMO_ACCESS.admin, registry)).toEqual({
      kind: 'redirect',
      to: '/models',
    });
  });
});

describe('navigation and all other entry points use the same module gate', () => {
  it('removes unavailable entries and empty groups', () => {
    expect(
      getNavigation(enterpriseA, DEMO_ACCESS.admin, moduleRegistry)
        .flatMap((group) => group.items)
        .map((item) => item.moduleId),
    ).toEqual(['modelCatalog', 'chat']);
    expect(getNavigation(enterpriseB, DEMO_ACCESS.chatOnly, moduleRegistry)).toEqual([
      {
        id: '在线体验',
        label: '在线体验',
        items: [
          {
            moduleId: 'chat',
            label: '智能对话',
            icon: '◌',
            href: '/chat',
            routeName: 'chat.index',
          },
        ],
      },
    ]);
    expect(getNavigation(enterpriseB, DEMO_ACCESS.noAccess, moduleRegistry)).toEqual([]);
    expect(getNavigation(enterpriseB, DEMO_ACCESS.anonymous, moduleRegistry)).toEqual([]);
  });

  it('keeps independently enabled video experiences available when image experience is disabled', () => {
    const videoOnly: BuildProfile = {
      ...enterpriseB,
      modules: { ...enterpriseB.modules, imageStudio: false },
    };
    expect(() => validateModuleAssembly(videoOnly)).not.toThrow();
    expect(getModuleHref('imageStudio', videoOnly, DEMO_ACCESS.admin, moduleRegistry)).toBeNull();
    expect(getModuleHref('videoStudio', videoOnly, DEMO_ACCESS.admin, moduleRegistry)).toBe(
      '/playground/video',
    );
    expect(
      resolveAppRoute('/playground/video/tasks/1', videoOnly, DEMO_ACCESS.admin, moduleRegistry)
        .kind,
    ).toBe('page');
  });

  it('provides explicit feedback for history and notification links', () => {
    expect(
      resolveModuleLink('imageStudio', enterpriseA, DEMO_ACCESS.admin, moduleRegistry),
    ).toMatchObject({
      available: false,
      reason: 'disabled',
    });
    expect(
      resolveModuleLink('chat', enterpriseA, DEMO_ACCESS.anonymous, moduleRegistry),
    ).toMatchObject({
      available: false,
      reason: 'unauthenticated',
    });
    expect(
      resolveModuleLink('imageStudio', enterpriseB, DEMO_ACCESS.chatOnly, moduleRegistry),
    ).toMatchObject({
      available: false,
      reason: 'forbidden',
    });
    expect(resolveModuleLink('chat', enterpriseA, DEMO_ACCESS.chatOnly, moduleRegistry)).toEqual({
      available: true,
      href: '/chat',
    });
  });

  it('filters shortcut, search and model-experience links without filtering model data', () => {
    const links = [
      { moduleId: 'chat' as const, model: 'text-model' },
      { moduleId: 'imageStudio' as const, model: 'image-model' },
      { moduleId: 'videoStudio' as const, model: 'video-model' },
    ];
    expect(filterModuleLinks(links, enterpriseA, DEMO_ACCESS.admin, moduleRegistry)).toEqual([
      links[0],
    ]);
    expect(links).toHaveLength(3);
  });

  it('treats authentication as necessary even if unverified permissions contain a wildcard', () => {
    const module = moduleRegistry[0];
    if (!module) throw new Error('Missing test module');
    expect(canViewModule(module, { authenticated: false, permissions: ['*'] })).toBe(false);
  });
});

describe('explicit module lifecycle', () => {
  it('starts only enabled permitted modules and disposes once in reverse order', async () => {
    const events: string[] = [];
    const activate = (name: string) =>
      vi.fn(() => {
        events.push(`start:${name}`);
        return () => {
          events.push(`stop:${name}`);
        };
      });
    const modelCatalog = activate('models');
    const chat = activate('chat');
    const imageStudio = activate('image');
    const videoStudio = activate('video');
    const cleanup = await activateModules(
      enterpriseA,
      DEMO_ACCESS.admin,
      {
        modelCatalog,
        chat,
        imageStudio,
        videoStudio,
      },
      moduleRegistry,
    );
    expect(events).toEqual(['start:models', 'start:chat']);
    expect(imageStudio).not.toHaveBeenCalled();
    expect(videoStudio).not.toHaveBeenCalled();
    await cleanup();
    await cleanup();
    expect(events).toEqual(['start:models', 'start:chat', 'stop:chat', 'stop:models']);
  });

  it('never activates unauthorized modules', async () => {
    const modelCatalog = vi.fn();
    const chat = vi.fn();
    await activateModules(
      enterpriseB,
      DEMO_ACCESS.chatOnly,
      { modelCatalog, chat },
      moduleRegistry,
    );
    expect(modelCatalog).not.toHaveBeenCalled();
    expect(chat).toHaveBeenCalledOnce();
    chat.mockClear();
    await activateModules(enterpriseB, DEMO_ACCESS.anonymous, { chat }, moduleRegistry);
    expect(chat).not.toHaveBeenCalled();
  });

  it('rolls back prior activation when a later module fails', async () => {
    const events: string[] = [];
    const error = new Error('Initialization failed');
    await expect(
      activateModules(
        enterpriseB,
        DEMO_ACCESS.admin,
        {
          modelCatalog: () => () => {
            events.push('stop:models');
          },
          chat: () => () => {
            events.push('stop:chat');
          },
          imageStudio: () => {
            throw error;
          },
          videoStudio: () => {
            events.push('start:video');
          },
        },
        moduleRegistry,
      ),
    ).rejects.toBe(error);
    expect(events).toEqual(['stop:chat', 'stop:models']);
  });

  it('continues cleaning remaining modules after a cleanup error', async () => {
    const cleanupModels = vi.fn();
    const cleanup = await activateModules(
      enterpriseA,
      DEMO_ACCESS.admin,
      {
        modelCatalog: () => cleanupModels,
        chat: () => () => {
          throw new Error('Cleanup failed');
        },
      },
      moduleRegistry,
    );
    await expect(cleanup()).rejects.toBeInstanceOf(AggregateError);
    expect(cleanupModels).toHaveBeenCalledOnce();
  });
});

describe('physically selected application assembly', () => {
  const videoRegistry = moduleRegistry.filter((module) => module.id === 'videoStudio');
  const modifiedFlags = { ...enterpriseB, id: 'qianshi', defaultModule: 'videoStudio' as const };

  it('does not restore omitted routes or links when disabled flags become true', () => {
    for (const path of [
      '/chat',
      '/models',
      '/playground/image',
      '/image-studio/tasks/1',
      '/playground/chat',
    ]) {
      expect(resolveAppRoute(path, modifiedFlags, DEMO_ACCESS.admin, videoRegistry)).toEqual({
        kind: 'not-found',
      });
    }
    expect(resolveAppRoute('/', modifiedFlags, DEMO_ACCESS.admin, videoRegistry)).toEqual({
      kind: 'redirect',
      to: '/playground/video',
    });
    expect(
      resolveModuleLink('chat', modifiedFlags, DEMO_ACCESS.admin, videoRegistry),
    ).toMatchObject({ available: false, reason: 'missing-entry' });
    expect(
      getNavigation(modifiedFlags, DEMO_ACCESS.admin, videoRegistry).flatMap((group) =>
        group.items.map((item) => item.moduleId),
      ),
    ).toEqual(['videoStudio']);
  });

  it('cannot activate omitted modules even if callers supply their activators', async () => {
    const chat = vi.fn();
    const imageStudio = vi.fn();
    const videoStudio = vi.fn();
    await activateModules(
      modifiedFlags,
      DEMO_ACCESS.admin,
      { chat, imageStudio, videoStudio },
      videoRegistry,
    );
    expect(chat).not.toHaveBeenCalled();
    expect(imageStudio).not.toHaveBeenCalled();
    expect(videoStudio).toHaveBeenCalledOnce();
  });

  it('requires standalone display metadata even for modules without navigation', () => {
    expect(() =>
      validateModuleAssembly(
        enterpriseB,
        changeModule('chat', { display: { title: '', icon: '◌' } }),
      ),
    ).toThrow(/展示信息/);
  });

  it('requires an active page loader in addition to a true profile flag', async () => {
    vi.resetModules();
    vi.stubGlobal('__BUILD_PROFILE__', enterpriseB);
    try {
      const features = await import('../../src/platform/features.ts');
      expect(features.buildProfile.modules.imageStudio).toBe(true);
      expect(features.isModuleEnabled('imageStudio')).toBe(false);
      expect(features.isModuleEnabled('chat')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
