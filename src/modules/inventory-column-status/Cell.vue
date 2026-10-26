<script setup lang="ts">
import type { StockRowContext } from '../../contracts/operations';
defineProps<{ context: StockRowContext }>();
</script>
<template>
  <span
    ><span class="status-badge">{{
      context.item.quantity - context.item.reserved < context.item.threshold
        ? '库存预警'
        : '库存充足'
    }}</span></span
  >
</template>
