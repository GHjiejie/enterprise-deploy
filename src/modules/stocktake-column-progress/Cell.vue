<script setup lang="ts">
import type { StocktakeRowContext } from '../../contracts/stocktake';
defineProps<{ context: StocktakeRowContext }>();
</script>
<template>
  {{ context.document.lines.filter((line) => line.counted !== null).length }} /
  {{ context.document.lines.length }} 项
</template>
