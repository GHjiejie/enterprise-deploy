<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
const headingId = useId();
let previous: Element | null = null;
onMounted(() => {
  previous = document.activeElement;
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
});
</script>
<template>
  <dialog
    ref="dialog"
    class="feature-dialog"
    :aria-labelledby="headingId"
    @cancel.prevent="emit('close')"
  >
    <header class="dialog-heading">
      <h2 :id="headingId">{{ title }}</h2>
      <button type="button" class="secondary" aria-label="关闭弹窗" @click="emit('close')">
        关闭
      </button>
    </header>
    <slot />
  </dialog>
</template>
