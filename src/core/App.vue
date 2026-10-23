<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useRuntime } from './runtime';

const runtime = useRuntime();
const route = useRoute();
const info = __BUILD_INFO__;
const persona = runtime.persona;
const activeTitle = computed(
  () => runtime.menus.find((menu) => menu.value.routeName === route.name)?.value.title ?? '页面',
);
const menus = computed(() =>
  runtime.menus.filter(({ owner, value }) => runtime.can(owner, value.permission)),
);
const allowed = computed(
  () =>
    typeof route.meta.owner !== 'string' ||
    typeof route.meta.permission !== 'string' ||
    runtime.can(route.meta.owner, route.meta.permission),
);
const reload = (): void => window.location.reload();
</script>

<template>
  <div class="workspace">
    <aside class="sidebar">
      <RouterLink to="/" class="brand"
        ><span class="brand-mark">E</span
        ><span
          >企业工作台<small>{{ info.brandName }}</small></span
        ></RouterLink
      >
      <p class="nav-label">工作空间</p>
      <nav aria-label="主导航">
        <RouterLink v-for="menu in menus" :key="menu.value.id" :to="{ name: menu.value.routeName }"
          >{{ menu.value.title }}<span aria-hidden="true">↗</span></RouterLink
        >
      </nav>
      <p v-if="menus.length === 0" class="muted">当前身份没有可用页面。</p>
      <div class="sidebar-footer">
        <span class="status-dot"></span>独立企业版本<small
          >{{ info.enterpriseId }} · {{ info.mode }}</small
        >
      </div>
    </aside>
    <div class="main-column">
      <header class="topbar">
        <span class="breadcrumb">工作空间 <span>/</span> {{ activeTitle }}</span>
        <label class="persona"
          >演示权限<select v-model="persona" aria-label="演示权限">
            <option value="admin">管理员</option>
            <option value="member">普通成员</option>
            <option value="none">无权限</option>
          </select></label
        >
      </header>
      <main>
        <div class="demo-note">
          本地演示数据 · 当前身份用于展示权限交集，真实服务需接入服务端授权。
        </div>
        <section v-if="runtime.chunkError.value" class="state-panel" role="alert">
          <h1>资源加载失败</h1>
          <p>{{ runtime.chunkError.value }}</p>
          <button @click="reload">刷新当前版本</button>
        </section>
        <RouterView v-else-if="allowed" />
        <section v-else class="state-panel">
          <h1>没有访问权限</h1>
          <p>当前身份或企业服务许可不允许访问此页面。</p>
        </section>
      </main>
      <footer class="build-footer">
        企业构建 {{ info.releaseId }}<span>仅装配本企业已批准能力</span>
      </footer>
    </div>
  </div>
</template>
