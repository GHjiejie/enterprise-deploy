<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { inventoryWorkspaceKey } from '../../contracts/operations';
import { stocktakeWorkspaceKey } from '../../contracts/stocktake';
import type {
  Stocktake,
  StocktakeContext,
  StocktakeRowContext,
  StocktakeStatus,
} from '../../contracts/stocktake';
import { useRuntime } from '../../core/runtime';
import { useColumns } from '../../shared/useColumns';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
const stock = inject(inventoryWorkspaceKey);
const store = inject(stocktakeWorkspaceKey);
if (!stock || !store) throw new Error('STOCKTAKE_WORKSPACE_NOT_PROVIDED');
const { documents, replace } = store;
const { items, replace: replaceStock } = stock;
const runtime = useRuntime();
const columns = useColumns('stocktakes');
const query = ref('');
const status = ref('全部');
const states: readonly StocktakeStatus[] = ['盘点中', '待复核', '待过账', '已过账', '已作废'];
const filtered = computed(() =>
  documents.value.filter(
    (item) =>
      `${item.id} ${item.title} ${item.warehouse}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()) &&
      (status.value === '全部' || status.value === item.status),
  ),
);
const context = computed<StocktakeContext>(() => ({
  documents: documents.value,
  items: items.value,
  replace: replaceStock,
  replaceDocuments: replace,
}));
const row = (document: Stocktake): StocktakeRowContext => ({ ...context.value, document });
const hasActions = computed(() =>
  runtime.extensions.stocktakeRows.some(({ owner, value }) => runtime.can(owner, value.permission)),
);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">INVENTORY RECONCILIATION</p>
        <h1>库存盘点</h1>
        <p class="muted">按仓盘点、复核差异，通过后统一过账。盘点期间发生库存变动时需退回重盘。</p>
      </div>
      <span class="tag">盘点 → 复核 → 过账</span>
    </div>
    <div class="metrics">
      <article>
        <p>进行中的盘点</p>
        <strong
          >{{ documents.filter((item) => item.status === '盘点中').length }}<span>单</span></strong
        ><small>逐项录入实盘数</small>
      </article>
      <article>
        <p>等待处理</p>
        <strong
          >{{ documents.filter((item) => ['待复核', '待过账'].includes(item.status)).length
          }}<span>单</span></strong
        ><small>复核或差异过账</small>
      </article>
      <article>
        <p>已完成过账</p>
        <strong
          >{{ documents.filter((item) => item.status === '已过账').length }}<span>单</span></strong
        ><small>库存已按实盘更新</small>
      </article>
    </div>
    <div class="content-card">
      <div class="table-toolbar">
        <div>
          <h2>盘点单</h2>
          <p class="muted">共 {{ filtered.length }} 单 · 每仓同一时间仅允许一张未结束盘点单</p>
        </div>
        <div class="toolbar-actions">
          <input
            v-model="query"
            type="search"
            aria-label="搜索盘点单"
            placeholder="单号、盘点名称或仓库"
          /><ExtensionPoint slot="stocktakeTools" :context="context" />
        </div>
      </div>
      <div class="filter-bar">
        <label
          >盘点状态
          <select v-model="status" aria-label="盘点状态筛选">
            <option>全部</option>
            <option v-for="state in states" :key="state">{{ state }}</option>
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
      <p v-if="!documents.length" class="table-state">
        暂无盘点单。创建盘点后将固定该仓的账面库存快照。
      </p>
      <p v-else-if="!filtered.length" class="table-state">没有符合条件的盘点单，请调整筛选。</p>
      <div v-else class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">盘点单 / 名称</th>
              <th v-for="column in columns" :key="column.value.id" scope="col">
                {{ column.value.title }}
              </th>
              <th v-if="hasActions" scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="document in filtered" :key="document.id">
              <td>
                {{ document.title }}
                <p class="muted">{{ document.id }}</p>
              </td>
              <td v-for="column in columns" :key="column.value.id">
                <component :is="column.value.component" :context="row(document)" />
              </td>
              <td v-if="hasActions">
                <div class="inline-actions">
                  <ExtensionPoint slot="stocktakeRows" :context="row(document)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
