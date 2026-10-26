<script setup lang="ts">
import type { OrderRowContext } from '../../contracts/operations';
import { currency } from '../../shared/format';
defineProps<{ context: OrderRowContext }>();
</script>
<template>
  <dl class="detail-grid">
    <dt>订单编号</dt>
    <dd>{{ context.order.id }}</dd>
    <dt>客户</dt>
    <dd>{{ context.order.customer }}</dd>
    <dt>金额</dt>
    <dd>{{ currency(context.order.amount) }}</dd>
    <dt>状态</dt>
    <dd>{{ context.order.status }}</dd>
  </dl>
</template>
