<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { approvalWorkspaceKey } from '../../contracts/operations';
import type { Approval, ApprovalContext, ApprovalRowContext } from '../../contracts/operations';
import { useRuntime } from '../../core/runtime';
import { useColumns } from '../../shared/useColumns';
import { currency } from '../../shared/format';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
const store = inject(approvalWorkspaceKey);
if (!store) throw new Error('APPROVALS_NOT_PROVIDED');
const { requests, replace } = store;
const runtime = useRuntime();
const columns = useColumns('approvals');
const query = ref('');
const status = ref('全部');
const filtered = computed(() =>
  requests.value.filter(
    (item) =>
      `${item.id} ${item.title} ${item.applicant}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()) &&
      (status.value === '全部' || item.status === status.value),
  ),
);
const pending = computed(() =>
  requests.value.filter((item) => item.status === '待审批' || item.status === '复核中'),
);
const context = computed<ApprovalContext>(() => ({ requests: requests.value, replace }));
const rowContext = (request: Approval): ApprovalRowContext => ({ ...context.value, request });
const hasActions = computed(() =>
  runtime.extensions.approvalRows.some(({ owner, value }) => runtime.can(owner, value.permission)),
);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">APPROVAL WORKFLOW</p>
        <h1>审批中心</h1>
        <p class="muted">演示规则：金额达到 ¥50,000 的申请需要初审与复核两步。</p>
      </div>
      <span class="tag">分级审批</span>
    </div>
    <div class="metrics">
      <article>
        <p>待处理申请</p>
        <strong>{{ pending.length }}<span>笔</span></strong
        ><small>包含初审与复核</small>
      </article>
      <article>
        <p>待处理金额</p>
        <strong>{{ currency(pending.reduce((sum, item) => sum + item.amount, 0)) }}</strong
        ><small>当前审批队列</small>
      </article>
      <article>
        <p>已完成审批</p>
        <strong>{{ requests.length - pending.length }}<span>笔</span></strong
        ><small>通过或驳回</small>
      </article>
    </div>
    <div class="content-card">
      <div class="table-toolbar">
        <div>
          <h2>审批申请</h2>
          <p class="muted">共 {{ filtered.length }} 条申请</p>
        </div>
        <div class="toolbar-actions">
          <input
            v-model="query"
            type="search"
            aria-label="搜索审批"
            placeholder="搜索单号、事由、申请人"
          /><ExtensionPoint slot="approvalTools" :context="context" />
        </div>
      </div>
      <div class="filter-bar">
        <label
          >审批状态
          <select v-model="status" aria-label="审批状态">
            <option>全部</option>
            <option>待审批</option>
            <option>复核中</option>
            <option>已通过</option>
            <option>已驳回</option>
          </select></label
        ><button
          v-if="query || status !== '全部'"
          class="secondary compact"
          @click="
            query = '';
            status = '全部';
          "
        >
          重置筛选
        </button>
      </div>
      <div v-if="!filtered.length" class="table-state">没有符合条件的审批申请，请调整筛选。</div>
      <div v-else class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">申请编号</th>
              <th v-for="column in columns" :key="column.value.id" scope="col">
                {{ column.value.title }}
              </th>
              <th v-if="hasActions" scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filtered" :key="item.id">
              <td>{{ item.id }}</td>
              <td v-for="column in columns" :key="column.value.id">
                <component :is="column.value.component" :context="rowContext(item)" />
              </td>
              <td v-if="hasActions">
                <div class="inline-actions">
                  <ExtensionPoint slot="approvalRows" :context="rowContext(item)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
