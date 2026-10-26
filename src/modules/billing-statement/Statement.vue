<script setup lang="ts">
import { ref } from 'vue';
import Modal from '../../shared/Modal.vue';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
const { values, pending, error, submit } = useRequest(spec);
const open = ref(false);
const empty = ref(false);
const downloaded = ref(false);
async function download(): Promise<void> {
  const result = await submit();
  if (!result) return;
  if (!result.message) {
    empty.value = true;
    return;
  }
  const blob = new Blob(['交易单号,月份,金额\nTX20261026001,' + values.month + ',500.00\n'], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `交易对账单-${values.month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  downloaded.value = true;
}
</script>
<template>
  <button class="secondary" data-feature="billing-statement" @click="open = true">下载对账单</button
  ><Modal v-if="open" title="下载交易对账单" @close="open = false"
    ><form class="feature-form" @submit.prevent="download">
      <label>账单月份<input v-model="values.month" type="month" /></label>
      <p class="muted">导出该月份的充值、消费与退款记录。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="empty" role="status">当前月份没有交易对账数据。</p>
      <p v-if="downloaded" class="success-note" role="status">对账单已下载。</p>
      <button type="submit" :disabled="pending">{{ pending ? '生成中…' : '下载 CSV' }}</button>
    </form></Modal
  >
</template>
