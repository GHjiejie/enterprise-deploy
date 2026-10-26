<script setup lang="ts">
import { ref } from 'vue';
import type { ApprovalRowContext } from '../../contracts/operations';
import Modal from '../../shared/Modal.vue';
import DetailTabs from '../../shared/DetailTabs.vue';
defineProps<{ context: ApprovalRowContext }>();
const open = ref(false);
</script>
<template>
  <button class="secondary compact" @click="open = true">审批详情</button
  ><Modal v-if="open" title="审批详情" @close="open = false"
    ><DetailTabs target="approval-detail" :context="context"
  /></Modal>
</template>
