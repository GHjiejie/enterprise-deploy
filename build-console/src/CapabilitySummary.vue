<script setup lang="ts">
import { computed } from 'vue';
import type { ModuleSummary } from '../../build/console/contracts';
import { groupCapabilities } from '../../build/console/grouping';
const props = defineProps<{ modules: readonly ModuleSummary[]; selected: readonly string[] }>();
const groups = computed(() => groupCapabilities(props.modules));
const enabled = (id: string): boolean => props.selected.includes(id);
</script>
<template>
  <div class="grouped-summary" aria-label="按模块汇总">
    <details v-for="group in groups" :key="group.id">
      <summary>
        <span>{{ group.title }}</span
        ><strong
          >{{ group.capabilities.filter((item) => enabled(item.id)).length }} /
          {{ group.capabilities.length }}</strong
        >
      </summary>
      <ul>
        <li
          v-for="item in group.capabilities"
          :key="item.id"
          :class="{ excluded: !enabled(item.id) }"
        >
          <span>{{ enabled(item.id) ? '✓' : '－' }}</span
          >{{ item.title }}
        </li>
      </ul>
    </details>
  </div>
</template>
