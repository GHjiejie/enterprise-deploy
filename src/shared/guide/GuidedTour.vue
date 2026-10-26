<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';
import type { GuideStep } from './types';
import { placeGuide, waitForGuideTarget } from './position';
const props = defineProps<{
  steps: readonly GuideStep[];
  storageKey: string;
  welcomeTitle: string;
  welcomeDescription: string;
  visit?: (step: GuideStep) => Promise<void>;
}>();
const uid = useId();
const phase = ref<'closed' | 'welcome' | 'tour'>('closed');
const activeId = ref('');
const busy = ref(false);
const error = ref('');
const dialog = ref<HTMLDialogElement>();
const card = ref<HTMLElement>();
const launcher = ref<HTMLButtonElement>();
const target = shallowRef<HTMLElement>();
const placement = ref<ReturnType<typeof placeGuide>>();
const index = computed(() =>
  Math.max(
    0,
    props.steps.findIndex((step) => step.id === activeId.value),
  ),
);
const current = computed(() => props.steps[index.value]);
let controller: AbortController | undefined;
let observer: ResizeObserver | undefined;
let frame = 0;
let generation = 0;
let previousFocus: Element | null = null;
function seen(): boolean {
  try {
    return localStorage.getItem(props.storageKey) !== null;
  } catch {
    return false;
  }
}
function reposition(): void {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (phase.value !== 'tour' || !target.value?.isConnected || !card.value) return;
    const rect = target.value.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      placement.value = undefined;
      return;
    }
    placement.value = placeGuide(
      rect,
      { width: document.documentElement.clientWidth, height: window.innerHeight },
      card.value.getBoundingClientRect(),
    );
  });
}
async function show(): Promise<void> {
  previousFocus = document.activeElement;
  phase.value = 'welcome';
  await nextTick();
  dialog.value?.showModal();
  card.value?.querySelector<HTMLButtonElement>('[data-guide-start]')?.focus();
}
function finish(completed = false): void {
  generation += 1;
  controller?.abort();
  observer?.disconnect();
  target.value = undefined;
  placement.value = undefined;
  busy.value = false;
  phase.value = 'closed';
  dialog.value?.close();
  try {
    localStorage.setItem(props.storageKey, completed ? 'completed' : 'dismissed');
  } catch {
    /* Browsers may deny storage; the guide still works for this visit. */
  }
  void nextTick(() => {
    if (
      previousFocus instanceof HTMLElement &&
      previousFocus.isConnected &&
      previousFocus !== document.body
    )
      previousFocus.focus();
    else launcher.value?.focus();
  });
}
async function go(next: number): Promise<void> {
  const step = props.steps[next];
  if (!step) {
    finish();
    return;
  }
  const request = ++generation;
  controller?.abort();
  observer?.disconnect();
  const pending = new AbortController();
  controller = pending;
  activeId.value = step.id;
  phase.value = 'tour';
  busy.value = true;
  error.value = '';
  placement.value = undefined;
  target.value = undefined;
  await nextTick();
  if (!dialog.value?.open) dialog.value?.showModal();
  try {
    await props.visit?.(step);
    if (request !== generation) return;
    await nextTick();
    const element = await waitForGuideTarget(step.target, pending.signal);
    if (request !== generation) return;
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    target.value = element;
    observer = new ResizeObserver(reposition);
    observer.observe(element);
    if (card.value) observer.observe(card.value);
  } catch (cause) {
    if (pending.signal.aborted || request !== generation) return;
    error.value = cause instanceof Error ? cause.message : '此功能暂时无法打开，请重试或继续查看。';
  } finally {
    if (request === generation) {
      busy.value = false;
      await nextTick();
      reposition();
      card.value?.querySelector<HTMLButtonElement>('[data-guide-next]')?.focus();
    }
  }
}
function keyboard(event: KeyboardEvent): void {
  if (phase.value !== 'tour' || busy.value) return;
  if (event.key === 'ArrowRight' && index.value < props.steps.length - 1) {
    event.preventDefault();
    void go(index.value + 1);
  }
  if (event.key === 'ArrowLeft' && index.value > 0) {
    event.preventDefault();
    void go(index.value - 1);
  }
}
watch(
  () => props.steps.map((step) => step.id).join('|'),
  (_next, previous) => {
    if (phase.value === 'closed') return;
    if (!props.steps.length) {
      generation += 1;
      controller?.abort();
      dialog.value?.close();
      phase.value = 'closed';
      return;
    }
    if (phase.value === 'tour' && !props.steps.some((step) => step.id === activeId.value)) {
      const oldIndex = previous?.split('|').indexOf(activeId.value) ?? 0;
      void go(Math.min(Math.max(0, oldIndex), props.steps.length - 1));
    }
  },
);
onMounted(() => {
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, true);
  if (props.steps.length && !seen()) void show();
});
onBeforeUnmount(() => {
  generation += 1;
  controller?.abort();
  observer?.disconnect();
  cancelAnimationFrame(frame);
  window.removeEventListener('resize', reposition);
  window.removeEventListener('scroll', reposition, true);
  dialog.value?.close();
});
const cardStyle = computed(() =>
  phase.value === 'tour' && placement.value
    ? { left: `${placement.value.card.left}px`, top: `${placement.value.card.top}px` }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
);
const highlightStyle = computed(() =>
  placement.value
    ? Object.fromEntries(
        Object.entries(placement.value.highlight).map(([key, value]) => [key, `${value}px`]),
      )
    : {},
);
</script>

<template>
  <button
    v-if="steps.length"
    ref="launcher"
    type="button"
    class="secondary compact guide-launch"
    data-guide="help"
    @click="show"
  >
    <span aria-hidden="true">?</span>新手指引
  </button>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="guide-dialog"
      :aria-labelledby="`${uid}-title`"
      :aria-describedby="`${uid}-description`"
      @cancel.prevent="finish()"
      @keydown="keyboard"
    >
      <template v-if="phase !== 'closed'">
        <div
          v-if="phase === 'tour' && placement && !busy"
          class="guide-highlight"
          :style="highlightStyle"
          :data-guide-target="current?.target"
          aria-hidden="true"
        ></div>
        <div v-else class="guide-shade" aria-hidden="true"></div>
        <section ref="card" class="guide-card" :style="cardStyle" :aria-busy="busy">
          <header class="guide-card-header">
            <span class="guide-badge">{{ phase === 'welcome' ? '快速上手' : '功能导览' }}</span
            ><button type="button" class="guide-close" aria-label="关闭指引" @click="finish()">
              ×
            </button>
          </header>
          <template v-if="phase === 'welcome'">
            <div class="guide-welcome-icon" aria-hidden="true">↗</div>
            <h2 :id="`${uid}-title`">{{ welcomeTitle }}</h2>
            <p :id="`${uid}-description`">{{ welcomeDescription }}</p>
            <div class="guide-welcome-note">
              <strong>{{ steps.length }} 个位置，逐步认识</strong
              ><span>高亮定位 · 随时跳过 · 支持重新查看</span>
            </div>
            <p class="guide-return-note">以后点击右上角「新手指引」，也能再次打开。</p>
            <footer class="guide-actions">
              <button type="button" class="guide-text" @click="finish()">稍后再说</button
              ><button type="button" data-guide-start class="guide-primary" @click="go(0)">
                开始了解 <span aria-hidden="true">→</span>
              </button>
            </footer>
          </template>
          <template v-else-if="current">
            <p class="guide-location">{{ current.location }}</p>
            <h2 :id="`${uid}-title`">{{ current.title }}</h2>
            <p :id="`${uid}-description`">{{ current.description }}</p>
            <p v-if="busy" class="guide-loading" role="status">正在定位功能位置…</p>
            <div v-if="error" class="guide-error" role="alert">
              <p>{{ error }}</p>
              <button type="button" class="guide-text" @click="go(index)">重新定位</button>
            </div>
            <div class="guide-progress">
              <span>第 {{ index + 1 }} / {{ steps.length }} 步</span
              ><progress :value="index + 1" :max="steps.length" aria-label="导览进度"></progress>
            </div>
            <footer class="guide-actions">
              <button type="button" class="guide-text" @click="finish()">跳过指引</button>
              <div>
                <button
                  type="button"
                  class="guide-back"
                  :disabled="busy || index === 0"
                  @click="go(index - 1)"
                >
                  上一步</button
                ><button
                  type="button"
                  data-guide-next
                  class="guide-primary"
                  :disabled="busy"
                  @click="index === steps.length - 1 ? finish(true) : go(index + 1)"
                >
                  {{ index === steps.length - 1 ? '完成指引' : '下一步'
                  }}<span v-if="index < steps.length - 1" aria-hidden="true">→</span>
                </button>
              </div>
            </footer>
          </template>
        </section>
      </template>
    </dialog>
  </Teleport>
</template>

<style scoped>
.guide-launch {
  border: 1px solid #e1e6ef;
  border-radius: 7px;
  padding: 7px 10px;
  background: white;
  color: #66758b;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  font-size: 12px;
}
.guide-launch > span {
  width: 17px;
  height: 17px;
  display: inline-grid;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 11px;
}
.guide-dialog {
  position: fixed;
  inset: 0;
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100dvh;
  max-width: none;
  max-height: none;
  border: 0;
  overflow: hidden;
  background: transparent;
  color: #273347;
}
.guide-dialog::backdrop {
  background: transparent;
}
.guide-shade {
  position: absolute;
  inset: 0;
  background: rgb(22 34 52 / 52%);
}
.guide-highlight {
  position: fixed;
  border: 2px solid var(--accent);
  border-radius: 10px;
  box-shadow: 0 0 0 9999px rgb(22 34 52 / 52%);
  pointer-events: none;
}
.guide-card {
  position: fixed;
  z-index: 1;
  width: min(380px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  background: white;
  border: 1px solid #e4e9f1;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 18px 60px rgb(19 36 58 / 22%);
  text-align: left;
}
.guide-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.guide-badge {
  color: var(--accent);
  background: var(--accent-soft, #eef6f3);
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
}
.guide-close {
  border: 0;
  border-radius: 5px;
  background: transparent;
  padding: 0;
  width: 28px;
  height: 28px;
  color: #8290a4;
  font-size: 25px;
  line-height: 1;
}
.guide-close:hover {
  color: #35445a;
  background: #f0f3f7;
}
.guide-card h2 {
  margin: 0 0 12px;
  font-size: 21px;
  line-height: 1.4;
  color: #273347;
}
.guide-card p {
  margin: 0;
  line-height: 1.8;
  font-size: 13px;
  color: #6c7b91;
}
.guide-card .guide-location {
  margin: 0 0 7px;
  font-size: 11px;
  color: #8b97a8;
}
.guide-welcome-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  font-size: 27px;
  color: var(--accent);
  background: var(--accent-soft, #eef6f3);
  border-radius: 13px;
}
.guide-welcome-note {
  display: grid;
  gap: 6px;
  margin: 20px 0 14px;
  padding: 14px;
  background: #f6f8fb;
  border: 1px solid #ebeff5;
  border-radius: 9px;
}
.guide-welcome-note strong {
  color: #4e5d73;
  font-size: 13px;
  font-weight: 600;
}
.guide-welcome-note span,
.guide-card .guide-return-note {
  font-size: 11px;
  color: #8b97a8;
}
.guide-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 22px;
}
.guide-actions > div {
  display: flex;
  gap: 8px;
}
.guide-primary,
.guide-back {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  border-radius: 7px;
  border: 0;
  padding: 10px 14px;
  font-size: 12px;
  white-space: nowrap;
}
.guide-primary {
  color: white;
  background: var(--accent);
}
.guide-primary:hover {
  background: var(--accent-dark);
}
.guide-back {
  color: #65738a;
  background: #eef2f7;
}
.guide-back:hover {
  background: #e6ebf3;
}
.guide-text {
  border: 0;
  background: transparent;
  color: #8b97a8;
  padding: 7px 0;
  border-radius: 4px;
  font-size: 11px;
}
.guide-text:hover {
  color: var(--accent);
  background: transparent;
}
.guide-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  color: #8b97a8;
  font-size: 11px;
}
.guide-progress progress {
  flex: 1;
  min-width: 0;
  height: 5px;
  border: 0;
  accent-color: var(--accent);
}
.guide-progress progress::-webkit-progress-bar {
  background: #edf1f6;
  border-radius: 10px;
}
.guide-progress progress::-webkit-progress-value {
  background: var(--accent);
  border-radius: 10px;
}
.guide-card .guide-loading {
  font-size: 11px;
  margin-top: 12px;
  color: var(--accent);
}
.guide-error {
  margin-top: 14px;
  border-radius: 6px;
  background: #fff5eb;
  padding: 10px;
}
.guide-error p {
  font-size: 12px;
  color: #a3693e;
}
@media (max-width: 420px) {
  .guide-card {
    padding: 20px;
  }
  .guide-primary,
  .guide-back {
    padding: 10px 12px;
  }
  .guide-actions {
    gap: 8px;
  }
}
</style>
