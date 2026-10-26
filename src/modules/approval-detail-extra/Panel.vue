<script setup lang="ts">
import type { ApprovalRowContext } from '../../contracts/operations';

defineProps<{ context: ApprovalRowContext }>();
</script>
<template>
  <p v-if="!context.request.extra?.length" class="muted">暂无扩展表单信息。</p>
  <dl v-else class="detail-grid">
    <template v-for="entry in context.request.extra" :key="entry.key"
      ><dt>{{ entry.label }}</dt>
      <dd>{{ entry.value }}</dd></template
    >
  </dl>
</template>
