<script setup lang="ts">
import type { OrderRowContext } from '../../contracts/operations';
import { useAction } from '../../shared/useAction';
const props = defineProps<{ context: OrderRowContext }>();
const { error, run } = useAction('order-priority', 'order.priority');
function toggle(): void {
  run(() => {
    const order = props.context.orders.find((item) => item.id === props.context.order.id);
    if (!order || order.status !== '待处理') throw new Error('只有待处理订单可以更改加急标记。');
    props.context.replace(
      props.context.orders.map((item) =>
        item.id === order.id ? { ...item, priority: !order.priority } : item,
      ),
    );
    return {
      area: '订单',
      action: order.priority ? '取消加急' : '标记加急',
      subject: order.id,
      detail: order.customer,
    };
  });
}
</script>
<template>
  <div>
    <button
      class="secondary compact"
      :aria-pressed="!!context.order.priority"
      :disabled="context.order.status !== '待处理'"
      :title="context.order.status !== '待处理' ? '已完成订单不能更改加急标记' : '切换加急标记'"
      @click="toggle"
    >
      {{ context.order.priority ? '取消加急' : '加急' }}
    </button>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </div>
</template>
