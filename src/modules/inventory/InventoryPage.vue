<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { inventoryWorkspaceKey } from '../../contracts/operations';
import type { InventoryContext, StockItem, StockRowContext } from '../../contracts/operations';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
import { useRuntime } from '../../core/runtime';
import { useColumns } from '../../shared/useColumns';
const store = inject(inventoryWorkspaceKey);
if (!store) throw new Error('INVENTORY_NOT_PROVIDED');
const { items, replace } = store;
const runtime = useRuntime();
const columns = useColumns('inventory');
const query = ref('');
const warehouse = ref('全部');
const lowOnly = ref(false);
const warehouses = computed(() => [...new Set(items.value.map((item) => item.warehouse))]);
const low = computed(() =>
  items.value.filter((item) => item.quantity - item.reserved < item.threshold),
);
const filtered = computed(() =>
  items.value.filter(
    (item) =>
      `${item.sku} ${item.name}`.toLowerCase().includes(query.value.trim().toLowerCase()) &&
      (warehouse.value === '全部' || item.warehouse === warehouse.value) &&
      (!lowOnly.value || item.quantity - item.reserved < item.threshold),
  ),
);
const context = computed<InventoryContext>(() => ({ items: items.value, replace }));
const rowContext = (item: StockItem): StockRowContext => ({ ...context.value, item });
const hasActions = computed(() =>
  runtime.extensions.inventoryRows.some(({ owner, value }) => runtime.can(owner, value.permission)),
);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">WAREHOUSE OPERATIONS</p>
        <h1>库存管理</h1>
        <p class="muted">按商品与仓库管理可用库存，所有变更在本次会话内保留。</p>
      </div>
      <span class="tag">库存台账</span>
    </div>
    <div class="metrics">
      <article>
        <p>库存总量</p>
        <strong>{{ items.reduce((sum, item) => sum + item.quantity, 0) }}<span>件</span></strong
        ><small>全部仓库实存</small>
      </article>
      <article>
        <p>预留库存</p>
        <strong>{{ items.reduce((sum, item) => sum + item.reserved, 0) }}<span>件</span></strong
        ><small>不可调拨或扣减</small>
      </article>
      <article>
        <p>库存预警</p>
        <strong>{{ low.length }}<span>项</span></strong
        ><small>可用量低于预警线</small>
      </article>
    </div>
    <div class="content-card">
      <div class="table-toolbar">
        <div>
          <h2>仓库库存</h2>
          <p class="muted">共 {{ filtered.length }} 条库存记录</p>
        </div>
        <div class="toolbar-actions">
          <input
            v-model="query"
            type="search"
            aria-label="搜索库存"
            placeholder="搜索 SKU 或商品"
          /><ExtensionPoint slot="inventoryTools" :context="context" />
        </div>
      </div>
      <div class="filter-bar">
        <label
          >仓库
          <select v-model="warehouse" aria-label="仓库筛选">
            <option>全部</option>
            <option v-for="name in warehouses" :key="name">{{ name }}</option>
          </select></label
        ><label><input v-model="lowOnly" type="checkbox" /> 仅看预警</label
        ><button
          v-if="query || warehouse !== '全部' || lowOnly"
          class="secondary compact"
          @click="
            query = '';
            warehouse = '全部';
            lowOnly = false;
          "
        >
          重置筛选
        </button>
      </div>
      <div v-if="!filtered.length" class="table-state">没有符合条件的库存，请调整筛选。</div>
      <div v-else class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">商品 / SKU</th>
              <th scope="col">仓库</th>
              <th v-for="column in columns" :key="column.value.id" scope="col">
                {{ column.value.title }}
              </th>
              <th v-if="hasActions" scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filtered" :key="item.id">
              <td>
                {{ item.name }}
                <p class="muted">{{ item.sku }}</p>
              </td>
              <td>{{ item.warehouse }}</td>
              <td v-for="column in columns" :key="column.value.id">
                <component :is="column.value.component" :context="rowContext(item)" />
              </td>
              <td v-if="hasActions">
                <ExtensionPoint slot="inventoryRows" :context="rowContext(item)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
