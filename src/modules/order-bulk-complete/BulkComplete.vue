<script setup lang="ts">
import { computed, ref } from 'vue';
import type { OrderActions } from '../../contracts/operations';
import Modal from '../../shared/Modal.vue';
import { useAction } from '../../shared/useAction';
import { completeOrders } from './model';
const props = defineProps<{ context: OrderActions }>();
const ids = ref<readonly string[]>([]);
const open = ref(false);
const reason = computed(() =>
  !props.context.selectedOrders.length
    ? '请先选择待处理订单'
    : props.context.selectedOrders.some((item) => item.status !== '待处理')
      ? '仅能批量完成待处理订单'
      : '',
);
const { error, run } = useAction('order-bulk-complete', 'order.complete');
function submit(): void {
  if (
    run(() => {
      props.context.replace(completeOrders(props.context.orders, ids.value));
      props.context.clearSelection();
      return {
        area: '订单',
        action: '批量完成',
        subject: ids.value.join('、'),
        detail: `完成 ${ids.value.length} 笔订单`,
      };
    })
  )
    open.value = false;
}
</script>
<template>
  <span :title="reason"
    ><button
      data-guide="tool:order-bulk-complete"
      class="secondary"
      :disabled="!!reason"
      :aria-label="reason ? `批量完成（${reason}）` : '批量完成'"
      @click="
        ids = context.selectedOrders.map((item) => item.id);
        open = true;
        error = '';
      "
    >
      批量完成
    </button></span
  >
  <Modal v-if="open" title="确认批量完成" @close="open = false"
    ><p>将以下 {{ ids.length }} 笔订单标记为已完成。本次演示中不能撤回。</p>
    <ul>
      <li v-for="id in ids" :key="id">{{ id }}</li>
    </ul>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <div class="form-actions">
      <button class="secondary" @click="open = false">取消</button
      ><button @click="submit">确认完成</button>
    </div></Modal
  >
</template>
