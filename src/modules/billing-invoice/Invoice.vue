<script setup lang="ts">
import { ref } from 'vue';
import type { Transaction } from '../../contracts/customer';
import Modal from '../../shared/Modal.vue';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
const props = defineProps<{ context: { transaction: Transaction } }>();
const { pending, error, reply, submit } = useRequest(spec);
const open = ref(false);
async function view(): Promise<void> {
  open.value = true;
  await submit();
}
</script>
<template>
  <button
    v-if="context.transaction.kind === '消费'"
    class="secondary compact"
    data-feature="billing-invoice"
    @click="view"
  >
    查看发票</button
  ><Modal v-if="open" title="电子发票" @close="open = false"
    ><p v-if="pending" role="status">正在加载发票…</p>
    <p v-else-if="error" class="form-error" role="alert">
      {{ error }}<button @click="view">重试</button>
    </p>
    <div v-else-if="reply?.message" class="invoice-paper">
      <h3>电子发票</h3>
      <p class="muted">发票号码 INV20261026001</p>
      <dl class="detail-grid">
        <dt>购买方</dt>
        <dd>演示科技有限公司</dd>
        <dt>项目名称</dt>
        <dd>信息技术服务</dd>
        <dt>价税合计</dt>
        <dd>¥ {{ props.context.transaction.amount.toFixed(2) }}</dd>
        <dt>关联交易</dt>
        <dd>{{ props.context.transaction.id }}</dd>
      </dl>
      <p class="muted">此为演示发票文件预览。</p>
    </div>
    <p v-else role="status">当前没有发票文件。</p></Modal
  >
</template>
