<script setup lang="ts">
import { ref, watch } from 'vue';
import type { InventoryContext } from '../../contracts/operations';
import Modal from '../../shared/Modal.vue';
import ConfiguredFields from '../../shared/ConfiguredFields.vue';
import { useConfiguredForm } from '../../shared/useConfiguredForm';
import { formNumber, formText } from '../../shared/form';
import { useAction } from '../../shared/useAction';
import { transferStock } from './model';
const props = defineProps<{ context: InventoryContext }>();
const open = ref(false);
const {
  fields,
  draft,
  available,
  blocked,
  context: environment,
  reset,
  read,
} = useConfiguredForm('inventory-transfer', ['sourceId', 'targetId', 'quantity', 'reason'], () => ({
  stockItems: props.context.items,
}));
const { error, run } = useAction('inventory-transfer', 'inventory.transfer');
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
      const sourceId = formText(submission.values, 'sourceId');
      const targetId = formText(submission.values, 'targetId');
      const quantity = formNumber(submission.values, 'quantity');
      const reason = formText(submission.values, 'reason');
      const source = props.context.items.find((item) => item.id === sourceId);
      const target = props.context.items.find((item) => item.id === targetId);
      const next = transferStock(props.context.items, sourceId, targetId, quantity, reason);
      if (!source || !target) throw new Error('请选择有效仓库。');
      const detail = `${source.warehouse} → ${target.warehouse}，${quantity} 件；${reason}`;
      const subject = source.sku;
      props.context.replace(next);
      return { area: '库存', action: '库存调拨', subject, detail };
    })
  ) {
    open.value = false;
    reset();
  }
}
</script>
<template>
  <button
    data-guide="tool:inventory-transfer"
    @click="
      open = true;
      error = '';
    "
  >
    库存调拨</button
  ><Modal v-if="open" title="库存调拨" @close="open = false"
    ><form class="feature-form" @submit.prevent="submit">
      <ConfiguredFields v-model="draft" :fields="fields" :environment="environment" />
      <p v-if="!available" class="form-error" role="alert">
        必填字段不可用，请检查企业许可或当前权限。
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit" :disabled="!available || blocked">确认调拨</button>
      </div>
    </form></Modal
  >
</template>
