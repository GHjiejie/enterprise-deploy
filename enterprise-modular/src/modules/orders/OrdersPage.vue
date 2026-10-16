<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Order } from '../../contracts/feature';
import { useRuntime } from '../../core/runtime';
import { currency } from '../../shared/format';
import { listOrders } from './api';
import './orders.css';

const runtime = useRuntime();
const orders = ref<readonly Order[]>([]);
const selection = ref<string[]>([]);
const query = ref('');
const status = ref<'loading' | 'ready' | 'error'>('loading');
let controller: AbortController | undefined;
const filtered = computed(() =>
  orders.value.filter((order) => `${order.id} ${order.customer}`.includes(query.value.trim())),
);
const selectedOrders = computed(() =>
  orders.value.filter((order) => selection.value.includes(order.id)),
);
const tools = computed(() =>
  runtime.orderTools.filter(({ owner, value }) => runtime.can(owner, value.permission)),
);
const total = computed(() => orders.value.reduce((sum, order) => sum + order.amount, 0));

async function load(): Promise<void> {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  status.value = 'loading';
  try {
    const result = await listOrders(request.signal);
    if (request.signal.aborted) return;
    orders.value = result;
    selection.value = [];
    status.value = 'ready';
  } catch {
    if (!request.signal.aborted) status.value = 'error';
  }
}
onMounted(() => void load());
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">OPERATIONS</p>
        <h1>订单管理</h1>
        <p class="muted">在一个工作空间中查看订单与处理进展。</p>
      </div>
      <span class="tag">订单基础能力</span>
    </div>
    <div class="metrics">
      <article>
        <p>订单总额</p>
        <strong>{{ currency(total) }}</strong
        ><small>当前演示订单</small>
      </article>
      <article>
        <p>订单数量</p>
        <strong>{{ orders.length }}<span>笔</span></strong
        ><small>所有订单状态</small>
      </article>
      <article>
        <p>待处理</p>
        <strong
          >{{ orders.filter((item) => item.status === '待处理').length }}<span>笔</span></strong
        ><small>等待业务处理</small>
      </article>
    </div>
    <div class="content-card">
      <div class="table-toolbar">
        <div>
          <h2>全部订单</h2>
          <p class="muted">已选择 {{ selection.length }} 笔订单</p>
        </div>
        <div class="toolbar-actions">
          <label class="search-label"
            ><span class="sr-only">搜索订单</span
            ><input
              v-model="query"
              type="search"
              placeholder="搜索订单号或客户"
              aria-label="搜索订单" /></label
          ><component
            v-for="tool in tools"
            :is="tool.value.component"
            :key="tool.value.id"
            :context="{ selectedOrders }"
          />
        </div>
      </div>
      <div v-if="status === 'loading'" class="table-state" role="status">正在加载订单…</div>
      <div v-else-if="status === 'error'" class="table-state" role="alert">
        订单加载失败。<button @click="load">重新加载</button>
      </div>
      <div v-else-if="filtered.length === 0" class="table-state">
        没有符合条件的订单，请调整搜索内容。
      </div>
      <div v-else class="table-scroll">
        <table class="orders-table">
          <thead>
            <tr>
              <th scope="col">选择</th>
              <th scope="col">订单编号</th>
              <th scope="col">客户</th>
              <th scope="col">订单金额</th>
              <th scope="col">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in filtered" :key="order.id">
              <td>
                <input
                  v-model="selection"
                  type="checkbox"
                  :value="order.id"
                  :aria-label="`选择 ${order.id}`"
                />
              </td>
              <td class="order-id">{{ order.id }}</td>
              <td>{{ order.customer }}</td>
              <td>{{ currency(order.amount) }}</td>
              <td>
                <span :class="['order-status', { pending: order.status === '待处理' }]">{{
                  order.status
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
