import { createApp, ref } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import modules from 'virtual:enterprise-modules';
import 'virtual:enterprise-brand';
import { runtimeKey } from '../contracts/feature';
import type { Persona, Runtime } from '../contracts/feature';
import App from '../core/App.vue';
import NotFound from '../core/NotFound.vue';
import { permitted } from '../core/runtime';
import '../core/style.css';
import { activateModules, assembleModules } from './assemble';

async function bootstrap(): Promise<void> {
  if (
    modules
      .map((item) => item.id)
      .sort()
      .join(',') !== [...__BUILD_INFO__.modules].sort().join(',')
  )
    throw new Error('REGISTRY_POLICY_MISMATCH');
  const assembly = assembleModules(modules);
  const runtime: Runtime = {
    menus: assembly.menus,
    orderTools: assembly.orderTools,
    persona: ref<Persona>('admin'),
    permissions: assembly.permissions,
    licensedModules: ref<ReadonlySet<string>>(new Set(__BUILD_INFO__.modules)),
    chunkError: ref(''),
    can(owner, permission) {
      return permitted(runtime, owner, permission);
    },
  };
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', redirect: assembly.routes[0]?.value.path ?? '/not-found' },
      ...assembly.routes.map(({ owner, value }) => ({
        name: value.name,
        path: value.path,
        component: value.load,
        meta: { owner, permission: value.permission },
      })),
      { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound },
    ],
  });
  router.onError(() => {
    runtime.chunkError.value = '功能资源加载失败，当前版本可能已更新。请刷新页面后重试。';
  });
  const dispose = await activateModules(modules);
  window.addEventListener('pagehide', dispose, { once: true });
  const app = createApp(App);
  app.provide(runtimeKey, runtime);
  app.use(router);
  app.mount('#app');
}

void bootstrap().catch(() => {
  const root = document.getElementById('app');
  if (root) root.textContent = '当前版本初始化失败，请刷新页面或联系管理员。';
});
