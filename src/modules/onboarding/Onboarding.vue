<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useRuntime } from '../../core/runtime';
import GuidedTour from '../../shared/guide/GuidedTour.vue';
import { guideStorageKey } from '../../shared/guide/types';
import type { GuideStep } from '../../shared/guide/types';
import { collectGuideSteps } from './model';
const runtime = useRuntime();
const storageKey = guideStorageKey(__BUILD_INFO__.enterpriseId);
const router = useRouter();
const steps = computed(() =>
  collectGuideSteps(
    runtime.menus,
    [...runtime.orderTools, ...Object.values(runtime.extensions).flat()],
    runtime.can,
  ),
);
async function visit(step: GuideStep): Promise<void> {
  if (step.routeName && router.currentRoute.value.name !== step.routeName)
    await router.push({ name: step.routeName });
}
</script>
<template>
  <GuidedTour
    :steps="steps"
    :visit="visit"
    :storage-key="storageKey"
    welcome-title="欢迎使用企业工作台"
    welcome-description="跟着指引认识菜单和常用操作，了解每个功能在哪里、可以完成什么。"
  />
</template>
