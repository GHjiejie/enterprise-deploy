<script setup lang="ts">
import { computed, ref } from 'vue';
import type { StocktakeRowContext } from '../../contracts/stocktake';
import Modal from '../../shared/Modal.vue';
import { useAction } from '../../shared/useAction';
import { submitStocktake } from './model';
const props = defineProps<{ context: StocktakeRowContext }>();
const open = ref(false);
const active = computed(() => ['盘点中'].includes(props.context.document.status));
const { error, run } = useAction('stocktake-submit', 'stocktake.submit');

function submit(): void {
  if (
    run(() => {
      const current = props.context.documents.find((item) => item.id === props.context.document.id);
      if (!current) throw new Error('盘点单已失效。');
      const next = submitStocktake(current);
      props.context.replaceDocuments(
        props.context.documents.map((item) => (item.id === current.id ? next : item)),
      );
      return {
        area: '盘点',
        action: '提交复核',
        subject: current.id,
        detail: next.history.at(-1)?.comment ?? '',
      };
    })
  ) {
    open.value = false;
  }
}
</script>
<template>
  <button
    v-if="active"
    class="secondary compact"
    @click="
      open = true;
      error = '';
    "
  >
    提交复核
  </button>
  <Modal v-if="open" title="确认提交复核" @close="open = false"
    ><form class="feature-form" @submit.prevent="submit">
      <p>{{ context.document.title }} · {{ context.document.warehouse }}</p>
      <p class="muted">全部明细录入后提交。提交后实盘记录锁定，退回重盘才能再次录入。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit">确认提交复核</button>
      </div>
    </form></Modal
  >
</template>
