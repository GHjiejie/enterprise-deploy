<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { draftErrors, releaseMode } from '../../build/console/contracts';
import type { Bootstrap, BuildJob, ProfileEntry, ReleaseMode } from '../../build/console/contracts';
import type { Enterprise } from '../../build/policy/types';
import { ApiError, bootstrap, getJob, saveProfile, startBuild } from './api';
import JobPanel from './JobPanel.vue';
import CapabilityManager from './CapabilityManager.vue';
import CapabilitySummary from './CapabilitySummary.vue';
import ConsoleGuide from './ConsoleGuide.vue';

interface Draft {
  schemaVersion: 1;
  enterpriseId: string;
  enabledModules: string[];
  brandingId: string;
}
const data = ref<Bootstrap>();
const initial = ref<'loading' | 'ready' | 'error'>('loading');
const initialError = ref('');
const selected = ref('__new__');
const draft = ref<Draft>({
  schemaVersion: 1,
  enterpriseId: '',
  enabledModules: [],
  brandingId: '',
});
const revision = ref<string | null>(null);
const mode = ref<ReleaseMode>('production');
const savedSignature = ref('');
const submitting = ref<'save' | 'build' | null>(null);
const message = ref('');
const error = ref('');
const conflict = ref(false);
const job = ref<BuildJob | null>(null);
const activeJobId = ref<string | null>(null);
const jobs = ref<BuildJob[]>([]);
const pollError = ref('');
const discardDialog = ref<HTMLDialogElement>();
let pendingDiscard: (() => void | Promise<void>) | undefined;
let pollController: AbortController | undefined;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
const bootstrapController = new AbortController();

const signature = (profile: Enterprise): string =>
  JSON.stringify({ ...profile, enabledModules: [...profile.enabledModules].sort() });
const dirty = computed(() => signature(draft.value) !== savedSignature.value);
const busy = computed(() => !!submitting.value || !!activeJobId.value);
const errors = computed(() =>
  data.value ? draftErrors(draft.value, data.value.modules, data.value.brands) : [],
);
const canSubmit = computed(() => !!data.value && !busy.value && errors.value.length === 0);
const brand = computed(() => data.value?.brands.find((item) => item.id === draft.value.brandingId));
const selectedModules = computed(
  () => data.value?.modules.filter((item) => draft.value.enabledModules.includes(item.id)) ?? [],
);
const excludedModules = computed(
  () => data.value?.modules.filter((item) => !draft.value.enabledModules.includes(item.id)) ?? [],
);

function choose(id: string): void {
  const entry = data.value?.enterprises.find((item) => item.profile.enterpriseId === id);
  const profile = entry?.profile ?? {
    schemaVersion: 1 as const,
    enterpriseId: '',
    enabledModules: [],
    brandingId: data.value?.brands[0]?.id ?? '',
  };
  selected.value = entry ? id : '__new__';
  draft.value = { ...profile, enabledModules: [...profile.enabledModules] };
  revision.value = entry?.revision ?? null;
  savedSignature.value = signature(profile);
  error.value = '';
  message.value = '';
  conflict.value = false;
  job.value = jobs.value.find((item) => item.profile.enterpriseId === id) ?? null;
  localStorage.setItem('enterprise-console-selection', selected.value);
}
async function discardThen(action: () => void | Promise<void>): Promise<void> {
  if (!dirty.value) {
    await action();
    return;
  }
  pendingDiscard = action;
  await nextTick();
  discardDialog.value?.showModal();
}
function selectEnterprise(event: Event): void {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const id = event.target.value;
  event.target.value = selected.value;
  void discardThen(() => choose(id));
}
async function confirmDiscard(): Promise<void> {
  const action = pendingDiscard;
  pendingDiscard = undefined;
  discardDialog.value?.close();
  await action?.();
}
function upsertJob(value: BuildJob): void {
  jobs.value = [value, ...jobs.value.filter((item) => item.id !== value.id)]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 30);
}
function stopPolling(): void {
  pollController?.abort();
  clearTimeout(pollTimer);
}
function poll(id: string): void {
  stopPolling();
  const controller = new AbortController();
  pollController = controller;
  const tick = async (): Promise<void> => {
    try {
      const value = await getJob(id, controller.signal);
      if (controller.signal.aborted) return;
      upsertJob(value);
      job.value = value;
      pollError.value = '';
      if (value.status !== 'running') {
        activeJobId.value = null;
        return;
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      pollError.value = cause instanceof Error ? cause.message : '读取任务状态失败';
    }
    pollTimer = setTimeout(() => void tick(), pollError.value ? 1500 : 750);
  };
  void tick();
}
async function load(): Promise<void> {
  try {
    const value = await bootstrap(bootstrapController.signal);
    if (bootstrapController.signal.aborted) return;
    data.value = value;
    jobs.value = [...value.jobs];
    const running = value.jobs.find((item) => item.id === value.activeJobId);
    const preferred =
      running?.profile.enterpriseId ?? localStorage.getItem('enterprise-console-selection');
    choose(
      value.enterprises.some((item) => item.profile.enterpriseId === preferred) && preferred
        ? preferred
        : (value.enterprises[0]?.profile.enterpriseId ?? '__new__'),
    );
    try {
      mode.value = releaseMode(
        running?.mode ?? localStorage.getItem('enterprise-console-mode') ?? 'production',
      );
    } catch {
      mode.value = 'production';
    }
    activeJobId.value = running?.id ?? null;
    if (running) {
      job.value = running;
      poll(running.id);
    }
    initial.value = 'ready';
  } catch (cause) {
    if (!bootstrapController.signal.aborted) {
      initialError.value = cause instanceof Error ? cause.message : '控制台加载失败';
      initial.value = 'error';
    }
  }
}
function accept(entry: ProfileEntry): void {
  if (!data.value) return;
  data.value = {
    ...data.value,
    enterprises: [
      ...data.value.enterprises.filter(
        (item) => item.profile.enterpriseId !== entry.profile.enterpriseId,
      ),
      entry,
    ].sort((a, b) => a.profile.enterpriseId.localeCompare(b.profile.enterpriseId)),
  };
  selected.value = entry.profile.enterpriseId;
  revision.value = entry.revision;
  draft.value = { ...entry.profile, enabledModules: [...entry.profile.enabledModules] };
  savedSignature.value = signature(entry.profile);
  localStorage.setItem('enterprise-console-selection', selected.value);
}
async function submit(build: boolean): Promise<void> {
  if (!canSubmit.value || !data.value) return;
  submitting.value = build ? 'build' : 'save';
  error.value = '';
  message.value = '';
  conflict.value = false;
  if (build) job.value = null;
  try {
    const profile: Enterprise = {
      ...draft.value,
      enabledModules: [...draft.value.enabledModules].sort(),
    };
    if (build) {
      const result = await startBuild(profile, revision.value, mode.value, data.value.csrfToken);
      accept(result.entry);
      upsertJob(result.job);
      job.value = result.job;
      activeJobId.value = result.job.status === 'running' ? result.job.id : null;
      if (activeJobId.value) poll(activeJobId.value);
    } else {
      accept(await saveProfile(profile, revision.value, data.value.csrfToken));
      message.value = '配置已保存。';
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '提交失败，请重试';
    conflict.value = cause instanceof ApiError && cause.code === 'conflict';
  } finally {
    submitting.value = null;
  }
}
function persistMode(): void {
  localStorage.setItem('enterprise-console-mode', mode.value);
}
function beforeUnload(event: BeforeUnloadEvent): void {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
onMounted(() => {
  void load();
  window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => {
  bootstrapController.abort();
  stopPolling();
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <div class="console-shell">
    <header class="console-header">
      <a class="console-brand" href="/"
        ><span class="brand-symbol">E</span
        ><span>企业构建中心<small>ENTERPRISE DELIVERY</small></span></a
      >
      <div class="console-header-actions">
        <ConsoleGuide v-if="initial === 'ready'" /><span class="local-badge"
          ><i></i>本地工作空间</span
        >
      </div>
    </header>
    <main class="console-main">
      <div class="page-heading">
        <div>
          <p class="eyebrow">CONFIGURE · BUILD · DELIVER</p>
          <h1>配置企业版本，一键完成打包</h1>
          <p class="page-description">按企业选择交付能力，让模块、品牌与构建结果保持一致。</p>
        </div>
        <div class="workflow-note">
          <span>↗</span>
          <p>配置在构建前固定<small>每个版本独立裁剪、审计与封包</small></p>
        </div>
      </div>
      <section v-if="initial === 'loading'" class="surface page-state" role="status">
        正在读取企业配置…
      </section>
      <section v-else-if="initial === 'error'" class="surface page-state" role="alert">
        <h2>控制台加载失败</h2>
        <p>{{ initialError }}</p>
        <button class="button primary" @click="load">重新加载</button>
      </section>
      <div v-else-if="data" class="console-layout">
        <div class="configuration-column">
          <form @submit.prevent="submit(true)">
            <fieldset :disabled="busy" class="configuration-fields">
              <section class="surface profile-section">
                <div class="section-heading">
                  <div>
                    <span class="section-index">01</span>
                    <h2>企业与构建环境</h2>
                  </div>
                  <span class="draft-state">{{ dirty ? '有未保存修改' : '已与配置同步' }}</span>
                </div>
                <div class="form-grid">
                  <label
                    >企业配置<select
                      :value="selected"
                      data-guide="console-enterprise"
                      aria-label="企业配置"
                      @change="selectEnterprise"
                    >
                      <option
                        v-for="entry in data.enterprises"
                        :key="entry.profile.enterpriseId"
                        :value="entry.profile.enterpriseId"
                      >
                        {{ entry.profile.enterpriseId }}
                      </option>
                      <option value="__new__">＋ 新建企业</option>
                    </select></label
                  ><label
                    >企业标识<input
                      v-model="draft.enterpriseId"
                      :readonly="selected !== '__new__'"
                      aria-label="企业标识"
                      placeholder="例如 enterprise-c"
                      autocomplete="off"
                      spellcheck="false" /></label
                  ><label
                    >企业品牌<select
                      data-guide="console-brand"
                      v-model="draft.brandingId"
                      aria-label="企业品牌"
                    >
                      <option v-for="item in data.brands" :key="item.id" :value="item.id">
                        {{ item.name }} · {{ item.id }}
                      </option>
                    </select></label
                  ><label
                    >构建环境<select v-model="mode" aria-label="构建环境" @change="persistMode">
                      <option value="production">生产环境 Production</option>
                      <option value="staging">预发布环境 Staging</option>
                    </select></label
                  >
                </div>
                <p class="field-note">企业决定包含哪些能力，环境决定本次构建模式。</p>
              </section>
              <CapabilityManager
                :modules="data.modules"
                :selected="draft.enabledModules"
                @change="
                  draft.enabledModules = $event;
                  message = '';
                "
              />
            </fieldset>
            <ul v-if="errors.length" class="validation-errors" aria-label="配置校验">
              <li v-for="item in errors" :key="item">{{ item }}</li>
            </ul>
            <div v-if="error" class="submission-error" role="alert">
              <p>{{ error }}</p>
              <button v-if="conflict" type="button" class="text-button" @click="discardThen(load)">
                重新加载服务器配置
              </button>
            </div>
            <p v-if="message" class="save-message" role="status">{{ message }}</p>
            <div class="form-actions" data-guide="console-actions">
              <p>
                {{
                  activeJobId
                    ? '正在使用固定快照打包，请等待当前任务完成。'
                    : '配置会保存为可评审的企业清单。'
                }}
              </p>
              <button
                type="button"
                class="button secondary"
                :disabled="!canSubmit"
                @click="submit(false)"
              >
                {{ submitting === 'save' ? '正在保存…' : '保存配置' }}</button
              ><button type="submit" class="button primary" :disabled="!canSubmit">
                {{ submitting === 'build' ? '正在提交…' : activeJobId ? '正在打包…' : '保存并打包'
                }}<span v-if="!busy" aria-hidden="true">↗</span>
              </button>
            </div>
          </form>
          <JobPanel :job="job" :modules="data.modules" :poll-error="pollError" />
        </div>
        <aside class="summary-column">
          <section class="surface delivery-summary">
            <p class="eyebrow">DELIVERY PREVIEW</p>
            <h2 data-guide="console-summary">本次交付配置</h2>
            <p class="summary-enterprise">{{ draft.enterpriseId || '待填写企业标识' }}</p>
            <div class="summary-meta">
              <span>品牌</span><strong>{{ brand?.name ?? '请选择' }}</strong
              ><span>环境</span
              ><strong>{{ mode === 'production' ? '生产环境' : '预发布环境' }}</strong>
            </div>
            <div class="summary-divider"></div>
            <h3>已选 {{ selectedModules.length }} 项 · 排除 {{ excludedModules.length }} 项</h3>
            <CapabilitySummary :modules="data.modules" :selected="draft.enabledModules" />
            <p class="summary-footnote">
              此处展示待构建配置。实际裁剪结果以完成后的审计与封包复验为准。
            </p>
          </section>
          <section class="history-section">
            <h2>最近打包任务</h2>
            <p v-if="!jobs.length" class="history-empty">完成首次打包后，任务会显示在这里。</p>
            <button
              v-for="item in jobs.slice(0, 8)"
              :key="item.id"
              type="button"
              :disabled="!!activeJobId"
              :class="['history-item', { active: job?.id === item.id }]"
              @click="job = item"
            >
              <span
                ><strong>{{ item.profile.enterpriseId }}</strong
                ><small
                  >{{
                    new Date(item.startedAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }}
                  · {{ item.mode }}</small
                ></span
              ><span :class="['history-status', item.status]">{{
                item.status === 'succeeded' ? '完成' : item.status === 'failed' ? '失败' : '进行中'
              }}</span>
            </button>
          </section>
        </aside>
      </div>
      <footer class="console-footer">
        <span>企业配置 → 静态装配 → 来源审计 → 封包复验</span
        ><span>本地开发工具 · 独立于客户交付站点</span>
      </footer>
    </main>
    <dialog ref="discardDialog" class="discard-dialog" aria-labelledby="discard-title">
      <h2 id="discard-title">放弃未保存的修改？</h2>
      <p>当前草稿尚未保存。切换或重新加载会覆盖这些修改。</p>
      <div>
        <button type="button" class="button secondary" @click="discardDialog?.close()">
          继续编辑</button
        ><button type="button" class="button primary" @click="confirmDiscard">
          放弃修改并继续
        </button>
      </div>
    </dialog>
  </div>
</template>
