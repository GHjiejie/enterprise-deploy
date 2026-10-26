<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRuntime } from '../../core/runtime';
import AuthFrame from '../../shared/product/AuthFrame.vue';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
const runtime = useRuntime();
const methods = computed(() =>
  runtime.extensions.accessTools.filter(
    ({ owner, value }) => value.group === 'method' && runtime.can(owner, value.permission),
  ),
);
const selected = ref('');
watch(
  methods,
  (items) => {
    if (!items.some((item) => item.value.id === selected.value))
      selected.value = items[0]?.value.id ?? '';
  },
  { immediate: true },
);
const active = computed(() => methods.value.find((item) => item.value.id === selected.value));
</script>
<template>
  <AuthFrame
    ><h1 class="auth-title">登录</h1>
    <p class="auth-subtitle">欢迎回来，继续你的工作。</p>
    <div v-if="methods.length > 1" class="auth-methods" role="tablist" aria-label="登录方式">
      <button
        v-for="method in methods"
        :key="method.value.id"
        role="tab"
        :aria-selected="selected === method.value.id"
        @click="selected = method.value.id"
      >
        {{ method.value.label }}
      </button>
    </div>
    <component v-if="active" :is="active.value.component" :key="active.value.id" :context="{}" />
    <p v-else class="auth-subtitle">当前版本暂未开放登录，请联系管理员。</p>
    <div class="auth-links"><ExtensionPoint slot="accessTools" group="links" :context="{}" /></div
  ></AuthFrame>
</template>
