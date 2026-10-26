<script setup lang="ts">
import { ref, watch } from 'vue';
import type { StocktakeLineContext } from '../../contracts/stocktake';
import Modal from '../../shared/Modal.vue';
import ConfiguredFields from '../../shared/ConfiguredFields.vue';
import { useConfiguredForm } from '../../shared/useConfiguredForm';
import { formNumber, formText } from '../../shared/form';
import { useAction } from '../../shared/useAction';
import { countStocktake } from './model';
const props = defineProps<{ context: StocktakeLineContext }>();
const open = ref(false);
const {
  fields,
  draft,
  available,
  blocked,
  context: environment,
  reset,
  read,
} = useConfiguredForm('stocktake-count', ['quantity', 'reason'], () => ({
  stocktakeLine: props.context.line,
}));
const { error, run } = useAction('stocktake-count', 'stocktake.count');
watch(
  fields,
  () => {
    error.value = '';
  },
  { flush: 'sync' },
);
function edit(): void {
  reset();
  if ('quantity' in draft.value)
    draft.value.quantity = props.context.line.counted ?? props.context.line.bookQuantity;
  if ('reason' in draft.value) draft.value.reason = props.context.line.reason;
  error.value = '';
  open.value = true;
}
function submit(): void {
  if (
    run(() => {
      const submission = read();
      const current = props.context.documents.find((item) => item.id === props.context.document.id);
      if (!current) throw new Error('盘点单已失效。');
      const next = countStocktake(
        current,
        props.context.line.stockId,
        formNumber(submission.values, 'quantity'),
        formText(submission.values, 'reason'),
      );
      props.context.replaceDocuments(
        props.context.documents.map((item) => (item.id === current.id ? next : item)),
      );
      return {
        area: '盘点',
        action: '录入实盘',
        subject: current.id,
        detail: next.history.at(-1)?.comment ?? '',
      };
    })
  ) {
    open.value = false;
    reset();
  }
}
</script>
<template>
  <button v-if="context.document.status === '盘点中'" class="secondary compact" @click="edit">
    {{ context.line.counted === null ? '录入实盘' : '修改实盘' }}
  </button>
  <Modal v-if="open" :title="`实盘录入 · ${context.line.name}`" @close="open = false"
    ><p class="muted">
      {{ context.line.sku }} · 账面 {{ context.line.bookQuantity }} 件 · 预留
      {{ context.line.bookReserved }} 件
    </p>
    <form class="feature-form" @submit.prevent="submit">
      <ConfiguredFields v-model="draft" :fields="fields" :environment="environment" />
      <p v-if="!available" class="form-error" role="alert">
        必填字段不可用，请检查企业许可或当前权限。
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit" :disabled="!available || blocked">保存实盘</button>
      </div>
    </form></Modal
  >
</template>
