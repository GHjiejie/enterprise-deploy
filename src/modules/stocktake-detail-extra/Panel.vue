<script setup lang="ts">
import type { StocktakeRowContext } from '../../contracts/stocktake';
defineProps<{ context: StocktakeRowContext }>();
</script>
<template>
  <dl v-if="context.document.extra.length" class="detail-grid">
    <template v-for="entry in context.document.extra" :key="entry.key"
      ><dt>{{ entry.label }}</dt>
      <dd>{{ entry.value }}</dd></template
    >
  </dl>
  <p v-else class="table-state">此盘点单没有扩展信息。</p>
</template>
