<script setup lang="ts">
import { inject, ref } from 'vue';
import type { Transaction } from '../../contracts/customer';
import { billingWorkspaceKey } from '../../contracts/customer';
import Modal from '../../shared/Modal.vue';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
const props = defineProps<{ context: { transaction: Transaction } }>();
const { values, pending, error, reply, submit, reset } = useRequest(spec);
const workspace = inject(billingWorkspaceKey);
const open = ref(false);
const reason = ref('');
function show(): void {
  reset();
  values.trade = props.context.transaction.id;
  open.value = true;
}
async function refund(): Promise<void> {
  if (!reason.value.trim()) {
    error.value = '请填写退款原因。';
    return;
  }
  if (await submit()) workspace?.refund(props.context.transaction.id);
}
</script>
<template>
  <button
    v-if="context.transaction.kind === '充值' && context.transaction.status === '已完成'"
    class="secondary compact"
    data-feature="billing-refund"
    @click="show"
  >
    申请退款</button
  ><Modal v-if="open" title="申请退款" @close="open = false"
    ><div v-if="reply" class="product-success" role="status">
      <span>✓</span>
      <h2>退款已受理</h2>
      <p>退款将退回原支付渠道。</p>
      <button @click="open = false">完成</button>
    </div>
    <form v-else class="feature-form" @submit.prevent="refund">
      <dl class="detail-grid">
        <dt>交易单号</dt>
        <dd>{{ context.transaction.id }}</dd>
        <dt>退款金额</dt>
        <dd>¥ {{ context.transaction.amount.toFixed(2) }}</dd>
      </dl>
      <label>退款原因<textarea v-model="reason" placeholder="请填写退款原因" /></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" @click="open = false">取消</button
        ><button type="submit" :disabled="pending">{{ pending ? '提交中…' : '确认退款' }}</button>
      </div>
    </form></Modal
  >
</template>
