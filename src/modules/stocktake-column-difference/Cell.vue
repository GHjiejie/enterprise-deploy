<script setup lang="ts">
import type { StocktakeRowContext } from '../../contracts/stocktake';
defineProps<{ context: StocktakeRowContext }>();
</script>
<template>
  {{
    context.document.lines.some((line) => line.counted === null)
      ? '待盘完'
      : context.document.lines.reduce(
          (sum, line) => sum + (line.counted ?? line.bookQuantity) - line.bookQuantity,
          0,
        ) + ' 件'
  }}
</template>
