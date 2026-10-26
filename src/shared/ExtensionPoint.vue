<script setup lang="ts">
import { computed } from 'vue';
import type { ExtensionSlot } from '../contracts/feature';
import { useRuntime } from '../core/runtime';
const props = defineProps<{ slot: ExtensionSlot; context: object; group?: string }>();
const runtime = useRuntime();
const items = computed(() =>
  runtime.extensions[props.slot].filter(
    ({ owner, value }) =>
      runtime.can(owner, value.permission) && (!props.group || value.group === props.group),
  ),
);
</script>
<template>
  <component
    v-for="item in items"
    :is="item.value.component"
    :key="item.value.id"
    :context="context"
  />
</template>
