<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { billingWorkspaceKey } from '../../contracts/customer';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
import { currency } from '../../shared/format';
const workspace = inject(billingWorkspaceKey);
if (!workspace) throw new Error('BILLING_MISSING');
const balance = workspace.balance;
const query = ref('');
const rows = computed(() =>
  workspace.transactions.value.filter((row) => !query.value || row.id.includes(query.value)),
);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">BILLING & PAYMENTS</p>
        <h1>费用与账单</h1>
        <p class="muted">查看账户余额与交易明细。</p>
      </div>
    </div>
    <div class="content-card billing-balance">
      <div>
        <p>账户可用余额</p>
        <strong>{{ currency(balance) }}</strong
        ><small>人民币账户 · 余额可用于业务消费</small>
      </div>
      <ExtensionPoint slot="billingTools" group="recharge" :context="{}" />
    </div>
    <div class="content-card">
      <div class="table-toolbar">
        <div>
          <h2>交易记录</h2>
          <p class="muted">最近的充值与消费明细</p>
        </div>
        <div class="product-header-actions">
          <label
            ><span class="sr-only">搜索交易单号</span
            ><input v-model="query" type="search" placeholder="搜索交易单号" /></label
          ><ExtensionPoint slot="billingTools" group="statement" :context="{}" />
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>交易单号</th>
              <th>交易时间</th>
              <th>类型</th>
              <th>金额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>{{ row.id }}</td>
              <td>{{ row.date }}</td>
              <td>{{ row.kind }}</td>
              <td>{{ row.kind === '充值' ? '+' : '−' }}{{ currency(row.amount) }}</td>
              <td>
                <span class="status-badge">{{ row.status }}</span>
              </td>
              <td>
                <div class="inline-actions">
                  <ExtensionPoint slot="billingRows" :context="{ transaction: row }" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!rows.length" class="product-table-empty">没有符合条件的交易记录。</p>
    </div>
  </section>
</template>
