<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { mediaWorkspaceKey } from '../../contracts/customer';
import { useRuntime } from '../../core/runtime';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
const runtime = useRuntime();
const workspace = inject(mediaWorkspaceKey);
const files = workspace?.files;
const methods = computed(() =>
  runtime.extensions.mediaTools.filter(
    ({ owner, value }) => value.group === 'studio' && runtime.can(owner, value.permission),
  ),
);
const selected = ref('');
watch(
  methods,
  (items) => {
    if (!items.some((item) => item.value.id === selected.value))
      selected.value = items[0]?.value.id ?? '';
  },
  { immediate: true },
);
const active = computed(() => methods.value.find((item) => item.value.id === selected.value));
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">CREATIVE STUDIO</p>
        <h1>创作空间</h1>
        <p class="muted">从一个想法开始，创作并管理你的内容。</p>
      </div>
      <ExtensionPoint slot="mediaTools" group="toolbar" :context="{}" />
    </div>
    <div v-if="methods.length" class="product-tabs" role="tablist" aria-label="创作类型">
      <button
        v-for="item in methods"
        :key="item.value.id"
        role="tab"
        :aria-selected="selected === item.value.id"
        @click="selected = item.value.id"
      >
        {{ item.value.label }}
      </button>
    </div>
    <component v-if="active" :is="active.value.component" :key="active.value.id" :context="{}" />
    <div class="content-card studio-library">
      <div class="table-toolbar">
        <h2>最近文件</h2>
        <span class="muted">{{ files?.length ?? 0 }} 个文件</span>
      </div>
      <ul v-if="files?.length" class="studio-file-list">
        <li v-for="file in files" :key="file.id">
          <small>{{ file.kind }}</small
          ><span>{{ file.name }}</span
          ><a :href="file.url" :download="file.name" class="text-action">下载</a>
        </li>
      </ul>
      <p v-else class="product-table-empty">还没有生成记录，开始你的第一次创作。</p>
    </div>
  </section>
</template>
