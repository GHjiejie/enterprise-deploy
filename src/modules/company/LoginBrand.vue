<script setup lang="ts">
import { company } from './mock';
</script>
<template>
  <div class="company-login" data-mock-company="login">
    <img :src="company.logo" alt="" width="40" height="40" />
    <div>
      <h2>{{ company.brand }}</h2>
      <p class="muted">{{ company.domain }}</p>
    </div>
  </div>
</template>
