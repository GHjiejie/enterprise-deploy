<script setup lang="ts">
import type { ApprovalRowContext } from '../../contracts/operations';
import { currency } from '../../shared/format';
defineProps<{ context: ApprovalRowContext }>();
</script>
<template>
  <span>{{ currency(context.request.amount) }}</span>
</template>
