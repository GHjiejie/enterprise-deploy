<script setup lang="ts">
import { inject, ref } from 'vue';
import { mediaWorkspaceKey } from '../../contracts/customer';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
const workspace = inject(mediaWorkspaceKey);
const { pending, error, submit } = useRequest(spec);
const done = ref(false);
async function download(): Promise<void> {
  if (!(await submit())) return;
  const csv =
    '文件名称,类型\n' +
    (workspace?.files.value
      .map((file) => `"${file.name.replaceAll('"', '""')}",${file.kind}`)
      .join('\n') ?? '');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = '文件列表.csv';
  a.click();
  URL.revokeObjectURL(url);
  done.value = true;
}
</script>
<template>
  <div class="product-inline" data-feature="media-export">
    <button class="secondary" :disabled="pending" @click="download">
      {{ pending ? '正在导出…' : '导出文件' }}</button
    ><span v-if="done" class="success-note" role="status">已导出</span
    ><span v-if="error" class="form-error" role="alert">{{ error }}</span>
  </div>
</template>
