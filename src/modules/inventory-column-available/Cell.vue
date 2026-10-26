<script setup lang="ts">
import type { StockRowContext } from '../../contracts/operations';
defineProps<{ context: StockRowContext }>();
</script>
<template>
  <span>{{ context.item.quantity - context.item.reserved }} / {{ context.item.threshold }}</span>
</template>
