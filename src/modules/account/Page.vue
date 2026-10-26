<script setup lang="ts">
import { computed } from 'vue';
import { useRuntime } from '../../core/runtime';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
const runtime = useRuntime();
const has = (group: string) =>
  runtime.extensions.accountTools.some(
    ({ owner, value }) => value.group === group && runtime.can(owner, value.permission),
  );
const security = computed(() => has('security'));
const identity = computed(() => has('identity'));
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">PERSONAL ACCOUNT</p>
        <h1>账号设置</h1>
        <p class="muted">管理个人资料、账号安全与身份认证。</p>
      </div>
      <span class="tag">企业成员</span>
    </div>
    <div class="content-card settings-panel" style="margin-bottom: 24px">
      <div class="settings-row">
        <div class="product-avatar">林</div>
        <div>
          <h2>林晓</h2>
          <p>账号 ID：U-000128 · 管理员</p>
        </div>
        <span class="status-badge">账号正常</span>
      </div>
    </div>
    <div v-if="security" class="content-card settings-panel" style="margin-bottom: 24px">
      <h2 class="settings-panel-heading">个人资料与安全</h2>
      <ExtensionPoint slot="accountTools" group="security" :context="{}" />
    </div>
    <div v-if="identity" class="content-card settings-panel">
      <h2 class="settings-panel-heading">身份认证</h2>
      <ExtensionPoint slot="accountTools" group="identity" :context="{}" />
    </div>
  </section>
</template>
