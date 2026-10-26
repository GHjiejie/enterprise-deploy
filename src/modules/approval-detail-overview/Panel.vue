<script setup lang="ts">
import type { ApprovalRowContext } from '../../contracts/operations';
import { currency } from '../../shared/format';
defineProps<{ context: ApprovalRowContext }>();
</script>
<template>
  <dl class="detail-grid">
    <dt>申请单号</dt>
    <dd>{{ context.request.id }}</dd>
    <dt>申请事由</dt>
    <dd>{{ context.request.title }}</dd>
    <dt>申请人</dt>
    <dd>{{ context.request.applicant }}</dd>
    <dt>金额</dt>
    <dd>{{ currency(context.request.amount) }}</dd>
    <dt>当前状态</dt>
    <dd>{{ context.request.status }}</dd>
  </dl>
</template>
