<script setup lang="ts">
import { ref, watch } from 'vue';
import type { OrderActions } from '../../contracts/operations';
import Modal from '../../shared/Modal.vue';
import ConfiguredFields from '../../shared/ConfiguredFields.vue';
import { useConfiguredForm } from '../../shared/useConfiguredForm';
import { formText, formNumber } from '../../shared/form';
import { useAction } from '../../shared/useAction';
import { createOrder } from './model';
const props = defineProps<{ context: OrderActions }>();
const open = ref(false);
const { fields, draft, available, reset, read } = useConfiguredForm('order-create', [
  'customer',
  'amount',
]);
const { error, run } = useAction('order-create', 'order.create');
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
      const order = createOrder(
        formText(submission.values, 'customer'),
        formNumber(submission.values, 'amount'),
        submission.extra,
      );
      props.context.replace([order, ...props.context.orders]);
      return {
        area: '订单',
        action: '新建订单',
        subject: order.id,
        detail: `${order.customer} · ¥${order.amount}`,
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
    data-guide="tool:order-create"
    @click="
      open = true;
      error = '';
    "
  >
    新建订单
  </button>
  <Modal v-if="open" title="新建订单" @close="open = false"
    ><form class="feature-form" @submit.prevent="submit">
      <ConfiguredFields v-model="draft" :fields="fields" />
      <p v-if="!available" class="form-error" role="alert">
        必填字段不可用，请检查企业许可或当前权限。
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit" :disabled="!available">创建订单</button>
      </div>
    </form></Modal
  >
</template>
