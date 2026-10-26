<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue';
import { CAPABILITY_KINDS, CAPABILITY_LABELS } from '../../build/console/contracts';
import type { ModuleSummary } from '../../build/console/contracts';
import { groupCapabilities, planSelection } from '../../build/console/grouping';

const props = defineProps<{ modules: readonly ModuleSummary[]; selected: readonly string[] }>();
const emit = defineEmits<{ change: [ids: string[]] }>();
const uid = useId();
const query = ref('');
const selection = ref('all');
const kind = ref('all');
const activeId = ref('orders');
const opened = ref<readonly string[]>(['基础能力']);
const dialog = ref<HTMLDialogElement>();
const proposal = ref<ReturnType<typeof planSelection>>();
const proposalTitle = ref('');
const groups = computed(() => groupCapabilities(props.modules));
const matches = (module: ModuleSummary): boolean =>
  `${module.id} ${module.title} ${module.description} ${module.section}`
    .toLowerCase()
    .includes(query.value.trim().toLowerCase()) &&
  (kind.value === 'all' || module.kind === kind.value) &&
  (selection.value === 'all' ||
    (selection.value === 'selected') === props.selected.includes(module.id));
const visibleGroups = computed(() =>
  groups.value.filter((group) => group.capabilities.some(matches)),
);
const active = computed(
  () => visibleGroups.value.find((group) => group.id === activeId.value) ?? visibleGroups.value[0],
);
const sections = computed(() => {
  const items = active.value?.capabilities.filter(matches) ?? [];
  const order = [
    '基础能力',
    '新建订单',
    '发起审批',
    '业务操作',
    '库存调整',
    '库存调拨',
    '创建盘点',
    '实盘录入',
    '提交复核',
    '审批通过',
    '审批驳回',
    '审批复核',
    '复核通过',
    '退回重盘',
    '差异过账',
    '作废盘点',
    '列表展示',
    '详情与记录',
  ];
  return [...new Set(items.map((item) => item.section))]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((title) => ({
      title,
      items: items
        .filter((item) => item.section === title)
        .sort((a, b) => CAPABILITY_KINDS.indexOf(a.kind) - CAPABILITY_KINDS.indexOf(b.kind)),
    }));
});
const title = (id: string): string => props.modules.find((item) => item.id === id)?.title ?? id;
const count = (items: readonly ModuleSummary[]): number =>
  items.filter((item) => props.selected.includes(item.id)).length;
const missing = (item: ModuleSummary): readonly string[] =>
  props.selected.includes(item.id)
    ? item.requires.filter((id) => !props.selected.includes(id))
    : [];
const issueCount = (items: readonly ModuleSummary[]): number =>
  items.filter(
    (item) =>
      missing(item).length ||
      (props.selected.includes(item.id) &&
        item.conflicts.some((id) => props.selected.includes(id))),
  ).length;
const expanded = (section: string): boolean => opened.value.includes(section);
watch([() => active.value?.id, query, kind, selection], () => {
  opened.value =
    query.value.trim() || kind.value !== 'all' || selection.value !== 'all'
      ? sections.value.map((section) => section.title)
      : ['基础能力'];
});
function toggle(id: string, event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return;
  emit(
    'change',
    event.target.checked
      ? [...new Set([...props.selected, id])]
      : props.selected.filter((item) => item !== id),
  );
}
function toggleSection(section: string): void {
  opened.value = opened.value.includes(section)
    ? opened.value.filter((item) => item !== section)
    : [...opened.value, section];
}
async function jump(id: string): Promise<void> {
  const item = props.modules.find((module) => module.id === id);
  if (!item) return;
  query.value = '';
  selection.value = 'all';
  kind.value = 'all';
  activeId.value = item.groupId;
  await nextTick();
  opened.value = [...new Set([...opened.value, item.section])];
  await nextTick();
  document.getElementById(`${uid}-${id}`)?.focus();
}
async function propose(ids: readonly string[], enabled: boolean, label: string): Promise<void> {
  proposal.value = planSelection(props.modules, props.selected, ids, enabled);
  proposalTitle.value = label;
  await nextTick();
  dialog.value?.showModal();
}
function apply(): void {
  if (proposal.value) emit('change', proposal.value.next);
  dialog.value?.close();
  proposal.value = undefined;
}
</script>

<template>
  <section class="surface modules-section" aria-label="模块能力管理">
    <div class="section-heading" data-guide="console-modules">
      <div>
        <span class="section-index">02</span>
        <h2>选择交付模块</h2>
      </div>
      <span class="selection-count">已选 {{ selected.length }} / {{ modules.length }} 项能力</span>
    </div>
    <p class="section-description">
      先选择业务模块，再按业务操作配置按钮与字段；列表和详情单独管理。
    </p>
    <div class="module-filters">
      <label
        >搜索能力<input v-model="query" type="search" placeholder="在所有模块中搜索名称或 ID"
      /></label>
      <label
        >选择状态<select v-model="selection">
          <option value="all">全部能力</option>
          <option value="selected">已启用</option>
          <option value="excluded">未启用</option>
        </select></label
      >
      <label
        >能力类型<select v-model="kind">
          <option value="all">全部类型</option>
          <option v-for="item in CAPABILITY_KINDS" :key="item" :value="item">
            {{ CAPABILITY_LABELS[item] }}
          </option>
        </select></label
      >
    </div>
    <div v-if="active" class="capability-workspace">
      <nav class="module-navigation" aria-label="业务模块">
        <button
          v-for="group in visibleGroups"
          :key="group.id"
          type="button"
          :aria-label="`管理${group.title}`"
          :aria-pressed="active.id === group.id"
          @click="activeId = group.id"
        >
          <span
            >{{ group.title
            }}<small
              >{{ count(group.capabilities) }} / {{ group.capabilities.length }} 项已启用</small
            ></span
          >
          <span v-if="issueCount(group.capabilities)" class="group-issue"
            >{{ issueCount(group.capabilities) }} 项待补齐</span
          >
          <span v-else aria-hidden="true">›</span>
        </button>
      </nav>
      <div class="module-detail" :aria-label="`${active.title}能力`">
        <div class="module-detail-heading" data-guide="console-capabilities">
          <div>
            <h3>{{ active.title }}</h3>
            <p>{{ active.description }}</p>
          </div>
          <div class="module-bulk-actions">
            <button
              type="button"
              class="text-button"
              @click="
                propose(
                  active.capabilities.map((item) => item.id),
                  true,
                  `启用${active.title}全部能力`,
                )
              "
            >
              启用整组
            </button>
            <button
              type="button"
              class="text-button"
              :disabled="!count(active.capabilities)"
              @click="
                propose(
                  active.capabilities.map((item) => item.id),
                  false,
                  `关闭${active.title}`,
                )
              "
            >
              关闭整组
            </button>
          </div>
        </div>
        <div v-if="issueCount(active.capabilities)" class="group-dependency-warning">
          <span>本模块有 {{ issueCount(active.capabilities) }} 项能力存在依赖或冲突问题。</span>
          <button
            type="button"
            class="text-button"
            @click="
              propose(
                active.capabilities
                  .filter((item) => selected.includes(item.id))
                  .map((item) => item.id),
                true,
                '补齐必需依赖',
              )
            "
          >
            补齐必需依赖
          </button>
        </div>
        <section
          v-for="(section, index) in sections"
          :key="section.title"
          class="capability-section"
        >
          <button
            type="button"
            class="capability-section-toggle"
            :aria-expanded="expanded(section.title)"
            :aria-controls="`${uid}-section-${index}`"
            @click="toggleSection(section.title)"
          >
            <span
              ><span aria-hidden="true">{{ expanded(section.title) ? '⌄' : '›' }}</span>
              {{ section.title }}</span
            >
            <small>{{ count(section.items) }} / {{ section.items.length }} 已选</small>
          </button>
          <div v-show="expanded(section.title)" :id="`${uid}-section-${index}`">
            <article
              v-for="module in section.items"
              :key="module.id"
              :class="[
                'capability-row',
                { selected: selected.includes(module.id), invalid: missing(module).length },
              ]"
            >
              <label :for="`${uid}-${module.id}`" class="capability-choice">
                <input
                  :id="`${uid}-${module.id}`"
                  type="checkbox"
                  :aria-label="module.title"
                  :checked="selected.includes(module.id)"
                  @change="toggle(module.id, $event)"
                />
                <span
                  ><strong>{{ module.title }}</strong
                  ><small>{{ module.description }}</small
                  ><code>{{ module.id }}</code></span
                >
                <span class="capability-kind">{{ CAPABILITY_LABELS[module.kind] }}</span>
              </label>
              <div v-if="module.requires.length" class="capability-dependencies">
                <span>依赖</span
                ><button
                  v-for="id in module.requires"
                  :key="id"
                  type="button"
                  :class="['dependency-link', { missing: missing(module).includes(id) }]"
                  :aria-label="`定位${title(id)}`"
                  @click="jump(id)"
                >
                  {{ title(id) }}{{ selected.includes(id) ? ' ✓' : '' }}
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
    <div v-else class="capability-empty">
      <p>没有符合条件的能力，请调整搜索或选择状态。</p>
      <button
        type="button"
        class="text-button"
        @click="
          query = '';
          selection = 'all';
          kind = 'all';
        "
      >
        清除筛选
      </button>
    </div>
    <dialog ref="dialog" class="selection-dialog" :aria-labelledby="`${uid}-proposal`">
      <h2 :id="`${uid}-proposal`">{{ proposalTitle }}</h2>
      <p>检查本次变更。依赖其他模块的能力会一起列出，应用后仍需保存配置。</p>
      <template v-if="proposal">
        <section v-if="proposal.added.length">
          <h3>将启用 {{ proposal.added.length }} 项</h3>
          <ul>
            <li v-for="id in proposal.added" :key="id">
              {{ title(id) }} <code>{{ id }}</code>
            </li>
          </ul>
        </section>
        <section v-if="proposal.removed.length">
          <h3>将关闭 {{ proposal.removed.length }} 项（含依赖这些能力的项目）</h3>
          <ul>
            <li v-for="id in proposal.removed" :key="id">
              {{ title(id) }} <code>{{ id }}</code>
            </li>
          </ul>
        </section>
        <p v-if="!proposal.added.length && !proposal.removed.length">当前配置无需更改。</p>
      </template>
      <div class="selection-dialog-actions">
        <button type="button" class="button secondary" @click="dialog?.close()">取消</button
        ><button
          type="button"
          class="button primary"
          :disabled="!proposal || (!proposal.added.length && !proposal.removed.length)"
          @click="apply"
        >
          应用更改
        </button>
      </div>
    </dialog>
  </section>
</template>
