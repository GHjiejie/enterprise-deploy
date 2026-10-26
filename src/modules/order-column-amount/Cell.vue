<script setup lang="ts">
import type { OrderRowContext } from '../../contracts/operations';
import { currency } from '../../shared/format';
defineProps<{ context: OrderRowContext }>();
</script>
<template>
  <span>{{ currency(context.order.amount) }}</span>
</template>
