<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { STAGES, STAGE_LABELS } from '../../build/console/contracts';
import type { BuildJob, ModuleSummary } from '../../build/console/contracts';

const props = defineProps<{
  job: BuildJob | null;
  modules: readonly ModuleSummary[];
  pollError: string;
}>();
const current = computed(() => (props.job ? STAGES.indexOf(props.job.stage) : -1));
const state = computed(() =>
  props.job?.status === 'succeeded'
    ? '打包完成'
    : props.job?.status === 'failed'
      ? '打包失败'
      : props.job
        ? '正在打包'
        : '等待开始',
);
const logElement = ref<HTMLElement>();
const now = ref(Date.now());
const timer = setInterval(() => {
  if (props.job?.status === 'running') now.value = Date.now();
}, 1000);
onBeforeUnmount(() => clearInterval(timer));
const elapsed = computed(() =>
  props.job
    ? Math.max(
        0,
        Math.floor(
          ((props.job.finishedAt ? Date.parse(props.job.finishedAt) : now.value) -
            Date.parse(props.job.startedAt)) /
            1000,
        ),
      )
    : 0,
);
const title = (id: string): string => props.modules.find((item) => item.id === id)?.title ?? id;
watch(
  () => props.job?.log,
  async () => {
    const element = logElement.value;
    const following =
      element && element.scrollTop + element.clientHeight >= element.scrollHeight - 32;
    await nextTick();
    if (element && following) element.scrollTop = element.scrollHeight;
  },
);
</script>

<template>
  <section class="surface build-panel" aria-label="打包任务">
    <div class="section-heading">
      <div>
        <span class="section-index">03</span>
        <h2>构建与交付</h2>
      </div>
      <span :class="['job-state', job?.status]" role="status">{{ state }}</span>
    </div>
    <p class="section-description">每一步对应实际构建阶段，复验通过后生成下载入口。</p>
    <div v-if="job" class="job-identity">
      <span>{{ job.profile.enterpriseId }}</span
      ><span>{{ job.mode === 'production' ? '生产环境' : '预发布环境' }}</span
      ><span>{{ elapsed }} 秒</span><code>{{ job.id }}</code>
    </div>
    <ol class="pipeline" aria-label="打包阶段">
      <li
        v-for="(stage, index) in STAGES"
        :key="stage"
        :class="{
          passed: job?.status === 'succeeded' || (job && index < current),
          current: job?.status === 'running' && index === current,
          failed: job?.status === 'failed' && index === current,
        }"
      >
        <span class="step-symbol" aria-hidden="true">{{
          job?.status === 'succeeded' || (job && index < current) ? '✓' : index + 1
        }}</span
        ><span>{{ STAGE_LABELS[stage] }}</span
        ><small>{{
          job?.status === 'succeeded' || (job && index < current)
            ? '通过'
            : index === current && job?.status === 'failed'
              ? '失败'
              : index === current && job?.status === 'running'
                ? '执行中'
                : '等待'
        }}</small>
      </li>
    </ol>
    <div v-if="!job" class="build-empty">
      <span aria-hidden="true">↗</span>
      <p>配置好企业能力后，点击“保存并打包”</p>
      <small>产物会绑定本次企业、模块组合和构建环境。</small>
    </div>
    <p v-if="pollError" class="inline-error" role="alert">
      {{ pollError }} 连接恢复后将自动更新任务状态。
    </p>
    <p v-if="job?.error" class="inline-error" role="alert">{{ job.error }}</p>
    <section
      v-if="job?.result"
      class="build-result"
      data-testid="build-result"
      aria-label="打包结果"
    >
      <div class="result-heading">
        <span aria-hidden="true">✓</span>
        <div>
          <h3>构建与封包复验通过</h3>
          <p>此结果固定对应上方任务的配置快照。</p>
        </div>
      </div>
      <div class="result-metrics">
        <div>
          <strong>{{ job.result.files }}</strong
          ><small>交付文件</small>
        </div>
        <div>
          <strong>{{ job.result.enabledModules.length }}</strong
          ><small>启用模块</small>
        </div>
        <div>
          <strong>{{ job.result.excludedModules.length }}</strong
          ><small>排除模块</small>
        </div>
      </div>
      <p class="result-modules">
        <span>已包含</span>{{ job.result.enabledModules.map(title).join('、') }}
      </p>
      <p v-if="job.result.excludedModules.length" class="result-modules">
        <span>已排除</span>{{ job.result.excludedModules.map(title).join('、') }}
      </p>
      <div class="artifact-actions">
        <a class="button primary" :href="`/api/builds/${job.id}/package`"
          >下载交付包 <span aria-hidden="true">↓</span></a
        ><a
          class="button secondary"
          :href="`/api/builds/${job.id}/preview`"
          target="_blank"
          rel="noopener"
          >预览此版本 <span aria-hidden="true">↗</span></a
        ><a class="report-link" :href="`/api/builds/${job.id}/report`">下载审计报告</a>
      </div>
      <details class="checksum">
        <summary>制品校验和</summary>
        <code>{{ job.result.packageHash }}</code>
      </details>
    </section>
    <details v-if="job" class="build-log" :open="job.status !== 'succeeded'">
      <summary>
        构建日志 <small>{{ job.status === 'running' ? '实时更新' : '本次任务' }}</small>
      </summary>
      <pre ref="logElement" tabindex="0" aria-label="构建日志内容" data-testid="build-log">{{
        job.log || '正在准备配置快照…'
      }}</pre>
    </details>
  </section>
</template>
