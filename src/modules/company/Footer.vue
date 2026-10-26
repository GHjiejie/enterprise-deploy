<script setup lang="ts">
import { company } from './mock';
</script>
<template>
  <div class="company-footer" data-mock-company="footer">
    <img :src="company.logo" alt="" width="24" height="24" />
    <span>{{ company.brand }} · {{ company.filing }}</span
    ><span>{{ company.domain }}</span>
  </div>
</template>
