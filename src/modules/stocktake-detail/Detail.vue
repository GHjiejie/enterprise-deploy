<script setup lang="ts">
import { ref } from 'vue';
import type { StocktakeRowContext } from '../../contracts/stocktake';
import Modal from '../../shared/Modal.vue';
import DetailTabs from '../../shared/DetailTabs.vue';
defineProps<{ context: StocktakeRowContext }>();
const open = ref(false);
</script>
<template>
  <button class="secondary compact" @click="open = true">盘点详情</button
  ><Modal v-if="open" title="盘点详情" @close="open = false"
    ><p>{{ context.document.title }} · {{ context.document.warehouse }}</p>
    <p class="muted">{{ context.document.id }} · {{ context.document.status }}</p>
    <DetailTabs target="stocktake-detail" :context="context"
  /></Modal>
</template>
