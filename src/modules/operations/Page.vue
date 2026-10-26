<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRuntime } from '../../core/runtime';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
const runtime = useRuntime();
const tabs = computed(() =>
  [
    { id: 'support', title: '客户支持' },
    { id: 'notifications', title: '通知与告警' },
    { id: 'security', title: '管理安全' },
    { id: 'assistant', title: '智能助手' },
  ].filter((tab) =>
    runtime.extensions.operationsTools.some(
      ({ owner, value }) => value.group === tab.id && runtime.can(owner, value.permission),
    ),
  ),
);
const selected = ref('');
watch(
  tabs,
  (items) => {
    if (!items.some((item) => item.id === selected.value)) selected.value = items[0]?.id ?? '';
  },
  { immediate: true },
);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">OPERATIONS & SUPPORT</p>
        <h1>协作与运维</h1>
        <p class="muted">跟踪客户问题，保持服务稳定运行。</p>
      </div>
      <span class="status-badge">● 服务运行正常</span>
    </div>
    <div class="product-tabs" role="tablist" aria-label="协作功能">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="selected === tab.id"
        @click="selected = tab.id"
      >
        {{ tab.title }}
      </button>
    </div>
    <div v-if="selected === 'assistant'">
      <ExtensionPoint slot="operationsTools" group="assistant" :context="{}" />
    </div>
    <div v-else-if="selected === 'support'" class="support-layout">
      <ExtensionPoint slot="operationsTools" group="support" :context="{ mode: 'toolbar' }" />
    </div>
    <div v-else-if="selected" class="content-card settings-panel">
      <ExtensionPoint slot="operationsTools" :group="selected" :context="{}" />
    </div>
    <div v-else class="state-panel">
      <h2>暂无可用服务</h2>
      <p>当前账号尚未开通协作服务。</p>
    </div>
  </section>
</template>
