<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import type { OrderToolContext } from '../../contracts/feature';
import type { ExportResponse } from '../../contracts/export';
import { prepareExport } from './api';
import './export.css';

const props = defineProps<{ context: OrderToolContext }>();
const state = ref<'idle' | 'submitting' | 'success' | 'failed'>('idle');
const message = ref('');
let worker: Worker | undefined;
let controller: AbortController | undefined;
let timeout: ReturnType<typeof setTimeout> | undefined;
let objectUrl: string | undefined;

function cleanup(): void {
  controller?.abort();
  worker?.terminate();
  worker = undefined;
  clearTimeout(timeout);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = undefined;
}
async function download(): Promise<void> {
  if (state.value === 'submitting' || props.context.selectedOrders.length === 0) return;
  cleanup();
  controller = new AbortController();
  const signal = controller.signal;
  state.value = 'submitting';
  message.value = '';
  try {
    const snapshot = props.context.selectedOrders.map((order) => ({ ...order }));
    const orders = await prepareExport(snapshot, signal);
    signal.throwIfAborted();
    const csv = await new Promise<string>((resolve, reject) => {
      worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<ExportResponse>) => {
        if (event.data.ok) resolve(event.data.csv);
        else reject(new Error(event.data.error));
      };
      worker.onerror = () => reject(new Error('导出处理失败，请重试'));
      timeout = setTimeout(() => reject(new Error('导出超时，请重试')), 15000);
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), {
        once: true,
      });
      worker.postMessage({ orders });
    });
    signal.throwIfAborted();
    objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'orders.csv';
    link.click();
    state.value = 'success';
    message.value = '订单已导出';
  } catch (error) {
    if (signal.aborted) return;
    state.value = 'failed';
    message.value = error instanceof Error ? error.message : '导出失败，请重试';
  } finally {
    cleanup();
  }
}
onBeforeUnmount(cleanup);
</script>

<template>
  <div class="export-control">
    <button
      :disabled="context.selectedOrders.length === 0 || state === 'submitting'"
      :title="context.selectedOrders.length === 0 ? '请先选择订单' : '导出所选订单'"
      @click="download"
    >
      {{ state === 'submitting' ? '正在导出…' : '导出订单' }}</button
    ><span v-if="message" :role="state === 'failed' ? 'alert' : 'status'">{{ message }}</span>
  </div>
</template>
