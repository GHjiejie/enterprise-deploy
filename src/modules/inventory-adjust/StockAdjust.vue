<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { StockRowContext } from '../../contracts/operations';
import Modal from '../../shared/Modal.vue';
import ConfiguredFields from '../../shared/ConfiguredFields.vue';
import { useConfiguredForm } from '../../shared/useConfiguredForm';
import { formNumber, formText } from '../../shared/form';
import { useAction } from '../../shared/useAction';
import { adjustStock } from './model';
const props = defineProps<{ context: StockRowContext }>();
const open = ref(false);
const {
  fields,
  draft,
  available,
  blocked,
  context: environment,
  reset,
  read,
} = useConfiguredForm('inventory-adjust', ['delta', 'reason']);
const { error, run } = useAction('inventory-adjust', 'inventory.adjust');
watch(
  fields,
  () => {
    error.value = '';
  },
  { flush: 'sync' },
);
const after = computed(() => props.context.item.quantity + Number(draft.value.delta ?? 0));
function submit(): void {
  if (
    run(() => {
      const submission = read();
      const delta = formNumber(submission.values, 'delta');
      const reason = formText(submission.values, 'reason');
      props.context.replace(adjustStock(props.context.items, props.context.item.id, delta, reason));
      return {
        area: '库存',
        action: '库存调整',
        subject: `${props.context.item.sku} · ${props.context.item.warehouse}`,
        detail: `${delta > 0 ? '+' : ''}${delta} 件；${reason}`,
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
    class="secondary compact"
    @click="
      open = true;
      error = '';
    "
  >
    调整库存</button
  ><Modal v-if="open" title="调整库存" @close="open = false"
    ><p>{{ context.item.name }} · {{ context.item.warehouse }}</p>
    <p class="muted">
      实存 {{ context.item.quantity }}，预留 {{ context.item.reserved }}。调整后：{{ after }} 件。
    </p>
    <form class="feature-form" @submit.prevent="submit">
      <ConfiguredFields v-model="draft" :fields="fields" :environment="environment" />
      <p v-if="!available" class="form-error" role="alert">
        必填字段不可用，请检查企业许可或当前权限。
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit" :disabled="!available || blocked">确认调整</button>
      </div>
    </form></Modal
  >
</template>
