<script setup lang="ts">
import { ref } from 'vue';
import type { OrderRowContext } from '../../contracts/operations';
import Modal from '../../shared/Modal.vue';
import DetailTabs from '../../shared/DetailTabs.vue';
defineProps<{ context: OrderRowContext }>();
const open = ref(false);
</script>
<template>
  <button class="secondary compact" @click="open = true">详情</button
  ><Modal v-if="open" title="订单详情" @close="open = false"
    ><DetailTabs target="order-detail" :context="context"
  /></Modal>
</template>
