<script setup lang="ts">
import { inject, ref } from 'vue';
import Modal from '../../shared/Modal.vue';
import { billingWorkspaceKey } from '../../contracts/customer';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
import qr from './assets/qr.svg';
const { values, pending, error, submit, reset } = useRequest(spec);
const workspace = inject(billingWorkspaceKey);
const open = ref(false);
const phase = ref<'amount' | 'payment' | 'done'>('amount');
function show(): void {
  reset();
  phase.value = 'amount';
  open.value = true;
}
function next(): void {
  const amount = Number(values.amount);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 100000 ||
    !/^\d+(?:[.]\d{1,2})?$/.test(values.amount ?? '')
  ) {
    error.value = '请输入 0 到 100000 之间的有效金额，最多两位小数。';
    return;
  }
  error.value = '';
  phase.value = 'payment';
}
async function paid(): Promise<void> {
  if (await submit()) {
    workspace?.recharge(Number(values.amount));
    phase.value = 'done';
  }
}
</script>
<template>
  <button data-feature="billing-recharge" @click="show">账户充值</button
  ><Modal v-if="open" title="账户充值" @close="open = false"
    ><form v-if="phase === 'amount'" class="feature-form" @submit.prevent="next">
      <label
        >充值金额（元）<input v-model="values.amount" type="number" min="0.01" step="0.01"
      /></label>
      <div class="amount-presets">
        <button
          v-for="amount in [100, 500, 1000]"
          :key="amount"
          type="button"
          class="secondary"
          @click="values.amount = String(amount)"
        >
          ¥ {{ amount }}
        </button>
      </div>
      <p class="muted">支付方式：微信支付</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button type="submit">下一步，扫码支付</button>
    </form>
    <div v-else-if="phase === 'payment'" class="auth-qr">
      <h3>微信扫码支付 ¥ {{ values.amount }}</h3>
      <img :src="qr" alt="微信支付演示二维码" />
      <p>演示环境请点击确认完成支付。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button :disabled="pending" @click="paid">{{ pending ? '确认中…' : '我已完成支付' }}</button>
    </div>
    <div v-else class="product-success" role="status">
      <span>✓</span>
      <h2>充值成功</h2>
      <p>¥ {{ values.amount }} 已计入账户余额。</p>
      <button @click="open = false">完成</button>
    </div></Modal
  >
</template>
