<script setup lang="ts">
import { ref } from 'vue';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
const { pending, error, submit } = useRequest(spec);
const synced = ref(false);
async function sync(): Promise<void> {
  if (await submit()) synced.value = true;
}
</script>
<template>
  <div class="content-card" data-feature="operations-ticket">
    <div class="table-toolbar">
      <div>
        <h2>客户工单</h2>
        <p class="muted">
          {{ synced ? '刚刚同步 · 共 2 条记录' : '查看问题进度，与团队协同处理。' }}
        </p>
      </div>
      <button class="secondary" :disabled="pending" @click="sync">
        {{ pending ? '同步中…' : '同步工单' }}
      </button>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>工单编号</th>
            <th>问题描述</th>
            <th>状态</th>
            <th>更新时间</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>TK-20261026-01</td>
            <td>充值到账进度咨询</td>
            <td><span class="status-badge">处理中</span></td>
            <td>今天 10:24</td>
          </tr>
          <tr>
            <td>TK-20261025-02</td>
            <td>账号认证资料补充</td>
            <td>已解决</td>
            <td>昨天 16:40</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="synced" role="status" class="success-note">工单已同步。</p>
  </div>
</template>
