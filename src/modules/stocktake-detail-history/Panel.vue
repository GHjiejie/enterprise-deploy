<script setup lang="ts">
import type { StocktakeRowContext } from '../../contracts/stocktake';
defineProps<{ context: StocktakeRowContext }>();
</script>
<template>
  <ol class="timeline">
    <li v-for="record in context.document.history" :key="record.id">
      <strong>{{ record.action }}</strong>
      <p>{{ record.comment }}</p>
      <time>{{ new Date(record.time).toLocaleString('zh-CN') }}</time>
    </li>
  </ol>
</template>
