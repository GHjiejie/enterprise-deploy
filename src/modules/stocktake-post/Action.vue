<script setup lang="ts">
import { computed, ref } from 'vue';
import type { StocktakeRowContext } from '../../contracts/stocktake';
import Modal from '../../shared/Modal.vue';
import { useAction } from '../../shared/useAction';
import { postStocktake } from './model';
const props = defineProps<{ context: StocktakeRowContext }>();
const open = ref(false);
const active = computed(() => ['待过账'].includes(props.context.document.status));
const { error, run } = useAction('stocktake-post', 'stocktake.post');

function submit(): void {
  if (
    run(() => {
      const current = props.context.documents.find((item) => item.id === props.context.document.id);
      if (!current) throw new Error('盘点单已失效。');
      const result = postStocktake(current, props.context.items);
      const next = result.document;
      props.context.replace(result.items);
      props.context.replaceDocuments(
        props.context.documents.map((item) => (item.id === current.id ? next : item)),
      );
      return {
        area: '盘点',
        action: '差异过账',
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
    差异过账
  </button>
  <Modal v-if="open" title="确认差异过账" @close="open = false"
    ><form class="feature-form" @submit.prevent="submit">
      <p>{{ context.document.title }} · {{ context.document.warehouse }}</p>
      <p class="muted">
        确认后按实盘数量更新该仓全部库存。将再次校验库存版本和预留量；任何一项不符合条件时整单不变。
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit">确认差异过账</button>
      </div>
    </form></Modal
  >
</template>
