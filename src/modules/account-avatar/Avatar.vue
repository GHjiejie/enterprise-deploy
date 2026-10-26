<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import Modal from '../../shared/Modal.vue';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
const { values, pending, error, submit } = useRequest(spec);
const open = ref(false);
const preview = ref('');
const saved = ref('');
function choose(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
    error.value = '请选择 2MB 以内的图片。';
    return;
  }
  if (preview.value && preview.value !== saved.value) URL.revokeObjectURL(preview.value);
  preview.value = URL.createObjectURL(file);
  values.file = file.name;
}
async function save(): Promise<void> {
  if (await submit()) {
    if (saved.value && saved.value !== preview.value) URL.revokeObjectURL(saved.value);
    saved.value = preview.value;
    open.value = false;
  }
}
onBeforeUnmount(() => {
  for (const url of new Set([preview.value, saved.value])) if (url) URL.revokeObjectURL(url);
});
</script>
<template>
  <div class="settings-row" data-feature="account-avatar">
    <img v-if="saved" :src="saved" class="product-avatar" alt="个人头像" />
    <div v-else class="product-avatar">林</div>
    <div>
      <h3>头像</h3>
      <p>支持 JPG、PNG，文件大小不超过 2MB。</p>
    </div>
    <button class="secondary" @click="open = true">更换头像</button>
  </div>
  <Modal v-if="open" title="更换头像" @close="open = false"
    ><form class="feature-form" @submit.prevent="save">
      <img v-if="preview" :src="preview" class="product-avatar" alt="头像预览" /><label
        >选择头像<input type="file" accept="image/*" @change="choose"
      /></label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="submit" :disabled="pending || !preview">
          {{ pending ? '正在保存…' : '保存头像' }}
        </button>
      </div>
    </form></Modal
  >
</template>
