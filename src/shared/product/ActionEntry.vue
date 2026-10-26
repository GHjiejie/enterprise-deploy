<script setup lang="ts">
import { ref } from 'vue';
import type { MockActionSpec } from '../../contracts/mock';
import Modal from '../Modal.vue';
import FormFields from './FormFields.vue';
import { useRequest } from './useRequest';
const props = defineProps<{
  spec: MockActionSpec;
  context?: { mode?: string };
  destination?: string;
  button?: string;
}>();
const { values, pending, error, reply, submit, reset } = useRequest(props.spec);
const open = ref(false);
const updated = ref(false);
function show(): void {
  reset();
  open.value = true;
}
async function save(): Promise<void> {
  if (await submit()) updated.value = true;
}
</script>
<template>
  <div
    :class="context?.mode === 'toolbar' ? 'product-inline' : 'settings-row'"
    :data-feature="spec.id"
  >
    <template v-if="context?.mode !== 'toolbar'"
      ><div>
        <h3>{{ spec.title }}</h3>
        <p>{{ updated ? '已更新' : spec.description }}</p>
      </div>
      <span v-if="updated" class="status-badge">已完成</span></template
    >
    <RouterLink v-if="destination" :to="destination" class="text-action"
      >{{ button ?? '前往设置' }} <span aria-hidden="true">→</span></RouterLink
    >
    <button v-else type="button" class="secondary" @click="show">{{ button ?? '设置' }}</button>
  </div>
  <Modal v-if="open" :title="spec.title" @close="open = false">
    <div v-if="reply" class="product-success" role="status">
      <span aria-hidden="true">✓</span>
      <h3>操作成功</h3>
      <p>{{ reply.message }}</p>
      <button @click="open = false">完成</button>
    </div>
    <form v-else class="feature-form" novalidate @submit.prevent="save">
      <FormFields
        @change="(key, value) => (values[key] = value)"
        :fields="spec.fields"
        :values="values"
        :pending="pending"
        :prefix="spec.id"
      />
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="secondary" :disabled="pending" @click="open = false">
          取消</button
        ><button type="submit" :disabled="pending">{{ pending ? '提交中…' : spec.button }}</button>
      </div>
    </form>
  </Modal>
</template>
