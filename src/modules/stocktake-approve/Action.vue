<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { StocktakeRowContext } from '../../contracts/stocktake';
import Modal from '../../shared/Modal.vue';
import ConfiguredFields from '../../shared/ConfiguredFields.vue';
import { useConfiguredForm } from '../../shared/useConfiguredForm';
import { formText } from '../../shared/form';
import { useAction } from '../../shared/useAction';
import { approveStocktake } from './model';
const props = defineProps<{ context: StocktakeRowContext }>();
const open = ref(false);
const active = computed(() => ['待复核'].includes(props.context.document.status));
const { error, run } = useAction('stocktake-approve', 'stocktake.approve');
const {
  fields,
  draft,
  available,
  blocked,
  context: environment,
  reset,
  read,
} = useConfiguredForm('stocktake-approve', []);
watch(
  fields,
  () => {
    error.value = '';
  },
  { flush: 'sync' },
);
function submit(): void {
  if (
    run(() => {
      const submission = read();
      const current = props.context.documents.find((item) => item.id === props.context.document.id);
      if (!current) throw new Error('盘点单已失效。');
      const next = approveStocktake(
        current,
        submission.values.comment === undefined ? '' : formText(submission.values, 'comment'),
      );
      props.context.replaceDocuments(
        props.context.documents.map((item) => (item.id === current.id ? next : item)),
      );
      return {
        area: '盘点',
        action: '复核通过',
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
  <button
    v-if="active"
    class="secondary compact"
    @click="
      open = true;
      error = '';
    "
  >
    复核通过
  </button>
  <Modal v-if="open" title="确认复核通过" @close="open = false"
    ><form class="feature-form" @submit.prevent="submit">
      <p>{{ context.document.title }} · {{ context.document.warehouse }}</p>
      <p class="muted">确认实盘数和差异原因已复核。通过后进入待过账状态。</p>
      <ConfiguredFields v-model="draft" :fields="fields" :environment="environment" />
      <p v-if="!available" class="form-error" role="alert">
        必填字段不可用，请检查企业许可或当前权限。
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit" :disabled="!available || blocked">确认复核通过</button>
      </div>
    </form></Modal
  >
</template>
