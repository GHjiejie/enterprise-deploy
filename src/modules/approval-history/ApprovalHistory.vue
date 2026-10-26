<script setup lang="ts">
import type { ApprovalRowContext } from '../../contracts/operations';
defineProps<{ context: ApprovalRowContext }>();
</script>
<template>
  <ol class="timeline">
    <li v-for="item in context.request.history" :key="item.id">
      <strong>{{ item.action }}</strong>
      <p>{{ item.comment }}</p>
      <time :datetime="item.time">{{ new Date(item.time).toLocaleString('zh-CN') }}</time>
    </li>
  </ol>
</template>
