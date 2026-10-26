<script setup lang="ts">
import type { ApprovalRowContext } from '../../contracts/operations';
defineProps<{ context: ApprovalRowContext }>();
</script>
<template>
  <span>{{ context.request.title }}</span>
</template>
