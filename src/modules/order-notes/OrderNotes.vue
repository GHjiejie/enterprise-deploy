<script setup lang="ts">
import { ref } from 'vue';
import type { OrderRowContext } from '../../contracts/operations';
import { useAction } from '../../shared/useAction';
import { requiredText } from '../../shared/validation';
const props = defineProps<{ context: OrderRowContext }>();
const text = ref('');
const { error, run } = useAction('order-notes', 'order.note');
function submit(): void {
  if (
    run(() => {
      const note = {
        id: crypto.randomUUID(),
        text: requiredText(text.value, '备注', 300),
        time: new Date().toLocaleString('zh-CN'),
      };
      const order = props.context.orders.find((item) => item.id === props.context.order.id);
      if (!order) throw new Error('订单已失效，请重新打开详情。');
      props.context.replace(
        props.context.orders.map((item) =>
          item.id === order.id ? { ...item, notes: [...(item.notes ?? []), note] } : item,
        ),
      );
      return { area: '订单', action: '追加备注', subject: order.id, detail: note.text };
    })
  )
    text.value = '';
}
</script>
<template>
  <section>
    <h2>跟进备注</h2>
    <p v-if="!context.order.notes?.length" class="muted">暂无备注，记录第一条跟进信息。</p>
    <ul v-else class="timeline">
      <li v-for="note in context.order.notes" :key="note.id">
        <p>{{ note.text }}</p>
        <time>{{ note.time }}</time>
      </li>
    </ul>
    <form class="feature-form" @submit.prevent="submit">
      <label
        >新增备注<textarea
          v-model="text"
          required
          maxlength="300"
          placeholder="填写跟进情况，最多 300 字"
        />
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions"><button type="submit">添加备注</button></div>
    </form>
  </section>
</template>
