<script setup lang="ts">
import { computed } from 'vue';
import { useRuntime } from '../../core/runtime';
import ExtensionPoint from '../ExtensionPoint.vue';
const runtime = useRuntime();
const branded = computed(() =>
  runtime.extensions.accessBrand.some(({ owner, value }) => runtime.can(owner, value.permission)),
);
</script>
<template>
  <div class="auth-page">
    <aside class="auth-story">
      <div class="auth-wordmark"><span>◈</span> ENTERPRISE CLOUD</div>
      <div class="auth-story-main">
        <p class="auth-overline">YOUR WORKSPACE, CONNECTED.</p>
        <h2>让工作，<br />井然有序。</h2>
        <p>连接你的团队与业务，<br />在专属工作空间里开启新的一天。</p>
        <div class="auth-illustration" aria-hidden="true">
          <div class="auth-orbit"></div>
          <div class="auth-window">
            <div class="auth-window-bar"><i></i><i></i><i></i></div>
            <div class="auth-window-body"><span></span><span></span><span></span><span></span></div>
            <div class="auth-mini-chart"><i></i><i></i><i></i><i></i><i></i></div>
          </div>
          <div class="auth-float">✓ <span>为每个团队，准备就绪</span></div>
        </div>
      </div>
      <small>专属空间 · 从容协作</small>
    </aside>
    <div class="auth-content">
      <RouterLink to="/" class="auth-home">← 返回工作台</RouterLink>
      <div class="auth-form-wrap">
        <ExtensionPoint v-if="branded" slot="accessBrand" :context="{}" />
        <div v-else class="auth-default-brand"><span>◈</span> 企业云工作台</div>
        <slot />
      </div>
      <p class="auth-environment">演示环境 · 所有操作仅影响本地数据</p>
    </div>
  </div>
</template>
