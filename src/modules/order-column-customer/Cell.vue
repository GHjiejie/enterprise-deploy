<script setup lang="ts">
import type { OrderRowContext } from '../../contracts/operations';
defineProps<{ context: OrderRowContext }>();
</script>
<template>
  <span>{{ context.order.customer }}</span>
</template>
