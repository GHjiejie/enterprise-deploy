<script setup lang="ts">
import type { ApprovalRowContext } from '../../contracts/operations';
defineProps<{ context: ApprovalRowContext }>();
</script>
<template>
  <span
    ><span class="status-badge">{{ context.request.status }}</span></span
  >
</template>
