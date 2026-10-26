<script setup lang="ts">
import type { StockRowContext } from '../../contracts/operations';
defineProps<{ context: StockRowContext }>();
</script>
<template>
  <span>{{ context.item.reserved }}</span>
</template>
