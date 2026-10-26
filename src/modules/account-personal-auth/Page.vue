<script setup lang="ts">
import FormPage from '../../shared/product/FormPage.vue';
import { spec } from './spec';
</script>
<template>
  <FormPage :spec="spec" back="/account" back-label="账号设置" :steps="['填写资料', '完成认证']" />
</template>
