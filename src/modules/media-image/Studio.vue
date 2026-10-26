<script setup lang="ts">
import { inject, ref } from 'vue';
import { mediaWorkspaceKey } from '../../contracts/customer';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
import image from './assets/result.svg';
const { values, pending, error, submit } = useRequest(spec);
const workspace = inject(mediaWorkspaceKey);
const ready = ref(false);
const size = ref('1024 × 1024');
async function generate(): Promise<void> {
  if (await submit()) {
    ready.value = true;
    workspace?.add({ id: crypto.randomUUID(), name: '海岸日落.svg', kind: '图片', url: image });
  }
}
</script>
<template>
  <div class="content-card studio-layout" data-feature="media-image">
    <form class="feature-form" @submit.prevent="generate">
      <h2>图片创作</h2>
      <label
        >画面描述<textarea
          v-model="values.prompt"
          placeholder="例如：日落时分的海岸，柔和的天空与远处的山"
        /></label
      ><label
        >图片尺寸<select v-model="size">
          <option>1024 × 1024</option>
          <option>1536 × 1024</option>
        </select></label
      >
      <p class="muted">描述越具体，越容易表达你的想法。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button type="submit" :disabled="pending">{{ pending ? '正在生成…' : '生成图片' }}</button>
    </form>
    <div class="studio-preview">
      <template v-if="ready"
        ><img :src="image" alt="生成的海岸日落图片" /><a
          :href="image"
          download="海岸日落.svg"
          class="text-action"
          >下载图片</a
        >
        <p role="status">图片已生成</p></template
      ><template v-else
        ><span class="preview-symbol" aria-hidden="true">▧</span>
        <p>{{ pending ? '正在创作，请稍候…' : '生成结果将在这里展示' }}</p></template
      >
    </div>
  </div>
</template>
