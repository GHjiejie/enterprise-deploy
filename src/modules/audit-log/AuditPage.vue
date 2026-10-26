<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { auditKey } from './store';
const store = inject(auditKey);
if (!store) throw new Error('AUDIT_NOT_PROVIDED');
const { events, discarded } = store;
const query = ref('');
const area = ref('全部');
const areas = computed(() => [...new Set(events.value.map((item) => item.area))]);
const filtered = computed(() =>
  events.value.filter(
    (item) =>
      (area.value === '全部' || item.area === area.value) &&
      `${item.subject} ${item.action} ${item.detail} ${item.actor}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">SESSION ACTIVITY</p>
        <h1>操作审计</h1>
        <p class="muted">记录本次浏览器会话最近 200 条成功操作，刷新页面后重置。</p>
      </div>
      <span class="tag">{{ events.length }} 条记录</span>
    </div>
    <p v-if="discarded" class="muted">
      已淘汰 {{ discarded }} 条较早记录。本地演示日志不替代服务端审计。
    </p>
    <div class="content-card">
      <div class="table-toolbar">
        <div>
          <h2>操作记录</h2>
          <p class="muted">查看订单、库存与审批的操作轨迹</p>
        </div>
        <input
          v-model="query"
          type="search"
          aria-label="搜索操作记录"
          placeholder="搜索对象、动作或内容"
        />
      </div>
      <div class="filter-bar">
        <label
          >业务领域
          <select v-model="area" aria-label="业务领域">
            <option>全部</option>
            <option v-for="item in areas" :key="item">{{ item }}</option>
          </select></label
        ><button
          v-if="query || area !== '全部'"
          class="secondary compact"
          @click="
            query = '';
            area = '全部';
          "
        >
          重置筛选
        </button>
      </div>
      <div v-if="!filtered.length" class="table-state">
        {{
          events.length
            ? '没有符合条件的操作记录，请调整筛选。'
            : '暂无操作记录，完成一次业务操作后即可在此查看。'
        }}
      </div>
      <div v-else class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">时间 / 操作人</th>
              <th scope="col">领域</th>
              <th scope="col">动作</th>
              <th scope="col">业务对象</th>
              <th scope="col">变更内容</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filtered" :key="item.id">
              <td>
                <time :datetime="item.time">{{ new Date(item.time).toLocaleString('zh-CN') }}</time>
                <p class="muted">{{ item.actor }}</p>
              </td>
              <td>{{ item.area }}</td>
              <td>{{ item.action }}</td>
              <td>{{ item.subject }}</td>
              <td class="audit-detail">{{ item.detail }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
<style scoped>
.audit-detail {
  min-width: 240px;
  max-width: 460px;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
