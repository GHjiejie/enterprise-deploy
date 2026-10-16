<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { currency } from '../../shared/format';
import { loadReport } from './api';
import chart from './assets/revenue.svg';
import './reports.css';

const report = ref<Awaited<ReturnType<typeof loadReport>>>();
const error = ref(false);
let controller: AbortController | undefined;
async function load(): Promise<void> {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  error.value = false;
  try {
    const result = await loadReport(request.signal);
    if (!request.signal.aborted) report.value = result;
  } catch {
    if (!request.signal.aborted) error.value = true;
  }
}
onMounted(() => void load());
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">BUSINESS INSIGHTS</p>
        <h1>经营报表</h1>
        <p class="muted">从业务数据中了解经营表现。</p>
      </div>
      <span class="tag">报表能力</span>
    </div>
    <div v-if="error" class="state-panel" role="alert">
      报表加载失败。<button @click="load">重试</button>
    </div>
    <template v-else-if="report"
      ><div class="metrics">
        <article>
          <p>订单总额</p>
          <strong>{{ currency(report.revenue) }}</strong
          ><small>演示数据汇总</small>
        </article>
        <article>
          <p>完成订单</p>
          <strong>{{ report.completed }}<span>笔</span></strong
          ><small>已完成交付</small>
        </article>
        <article>
          <p>客户数量</p>
          <strong>{{ report.customers }}<span>家</span></strong
          ><small>当前业务客户</small>
        </article>
      </div>
      <div class="content-card report-chart">
        <h2>收入趋势示意</h2>
        <p class="muted">本图为报表模块专属演示资源。</p>
        <img :src="chart" alt="收入趋势示意图，从周一到周五逐步增长" />
        <p class="report-footnote">演示图仅用于验证模块资源裁剪，不代表真实经营数据。</p>
      </div></template
    >
    <p v-else role="status">正在加载报表…</p>
  </section>
</template>
