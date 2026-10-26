<script setup lang="ts">
import { ref, watch } from 'vue';
import type { StocktakeContext } from '../../contracts/stocktake';
import Modal from '../../shared/Modal.vue';
import ConfiguredFields from '../../shared/ConfiguredFields.vue';
import { useConfiguredForm } from '../../shared/useConfiguredForm';
import { formText } from '../../shared/form';
import { useAction } from '../../shared/useAction';
import { createStocktake } from './model';
const props = defineProps<{ context: StocktakeContext }>();
const open = ref(false);
const {
  fields,
  draft,
  available,
  blocked,
  context: environment,
  reset,
  read,
} = useConfiguredForm('stocktake-create', ['title', 'warehouse'], () => ({
  stockItems: props.context.items,
}));
const { error, run } = useAction('stocktake-create', 'stocktake.create');
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
      const document = createStocktake(
        props.context.documents,
        props.context.items,
        formText(submission.values, 'title'),
        formText(submission.values, 'warehouse'),
        submission.extra,
      );
      props.context.replaceDocuments([document, ...props.context.documents]);
      return {
        area: '盘点',
        action: '创建盘点',
        subject: document.id,
        detail: `${document.title} · ${document.warehouse} · ${document.lines.length} 项`,
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
    data-guide="tool:stocktake-create"
    @click="
      open = true;
      error = '';
    "
  >
    创建盘点
  </button>
  <Modal v-if="open" title="创建盘点" @close="open = false"
    ><form class="feature-form" @submit.prevent="submit">
      <ConfiguredFields v-model="draft" :fields="fields" :environment="environment" />
      <p v-if="!available" class="form-error" role="alert">
        必填字段不可用，请检查企业许可或当前权限。
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit" :disabled="!available || blocked">确认创建盘点</button>
      </div>
    </form></Modal
  >
</template>
