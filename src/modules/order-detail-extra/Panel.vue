<script setup lang="ts">
import type { OrderRowContext } from '../../contracts/operations';

defineProps<{ context: OrderRowContext }>();
</script>
<template>
  <p v-if="!context.order.extra?.length" class="muted">暂无扩展表单信息。</p>
  <dl v-else class="detail-grid">
    <template v-for="entry in context.order.extra" :key="entry.key"
      ><dt>{{ entry.label }}</dt>
      <dd>{{ entry.value }}</dd></template
    >
  </dl>
</template>
