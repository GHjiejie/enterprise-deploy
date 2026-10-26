<script setup lang="ts">
import type { StocktakeRowContext } from '../../contracts/stocktake';
defineProps<{ context: StocktakeRowContext }>();
</script>
<template>
  <span class="status-badge">{{ context.document.status }}</span>
</template>
