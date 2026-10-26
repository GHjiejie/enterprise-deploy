<script setup lang="ts">
import type { OrderRowContext } from '../../contracts/operations';
defineProps<{ context: OrderRowContext }>();
</script>
<template>
  <span
    ><span class="status-badge">{{ context.order.status }}</span></span
  >
</template>
