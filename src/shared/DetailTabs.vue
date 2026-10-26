<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue';
import type { DetailTarget } from '../contracts/presentation';
import { useRuntime } from '../core/runtime';
const props = defineProps<{ target: DetailTarget; context: object }>();
const runtime = useRuntime();
const uid = useId();
const tabs = computed(() =>
  runtime.detailTabs.filter(
    ({ owner, value }) => value.target === props.target && runtime.can(owner, value.permission),
  ),
);
const active = ref('');
const visited = ref<ReadonlySet<string>>(new Set());
watch(
  tabs,
  (next) => {
    const ids = new Set(next.map((item) => item.value.id));
    const previous = active.value;
    const focus = document.activeElement;
    const restoreFocus =
      !ids.has(previous) &&
      !!focus &&
      (document.getElementById(`${uid}-tab-${previous}`) === focus ||
        document.getElementById(`${uid}-panel-${previous}`)?.contains(focus));
    if (!ids.has(active.value)) active.value = next[0]?.value.id ?? '';
    if (restoreFocus && active.value)
      void nextTick(() => document.getElementById(`${uid}-tab-${active.value}`)?.focus());
    visited.value = new Set([...visited.value, active.value].filter((id) => ids.has(id)));
  },
  { immediate: true, flush: 'sync' },
);
function select(id: string, focus = false): void {
  active.value = id;
  visited.value = new Set([...visited.value, id]);
  if (focus) void nextTick(() => document.getElementById(`${uid}-tab-${id}`)?.focus());
}
function navigate(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = tabs.value.findIndex((item) => item.value.id === active.value);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.value.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.value.length) % tabs.value.length;
  const tab = tabs.value[next];
  if (tab) select(tab.value.id, true);
}
</script>
<template>
  <p v-if="!tabs.length" class="table-state">当前企业或身份没有可用详情页签。</p>
  <template v-else
    ><div class="detail-tabs" role="tablist" aria-label="详情页签" @keydown="navigate">
      <button
        v-for="{ value: tab } in tabs"
        :id="`${uid}-tab-${tab.id}`"
        :key="tab.id"
        role="tab"
        type="button"
        :aria-selected="active === tab.id"
        :tabindex="active === tab.id ? 0 : -1"
        :aria-controls="`${uid}-panel-${tab.id}`"
        @click="select(tab.id)"
      >
        {{ tab.title }}
      </button>
    </div>
    <section
      v-for="{ value: tab } in tabs"
      v-show="active === tab.id"
      :id="`${uid}-panel-${tab.id}`"
      :key="tab.id"
      role="tabpanel"
      :aria-labelledby="`${uid}-tab-${tab.id}`"
      tabindex="0"
    >
      <component v-if="visited.has(tab.id)" :is="tab.component" :context="context" /></section
  ></template>
</template>
