<script setup lang="ts">
import { useRouter } from 'vue-router';
import AuthFrame from '../../shared/product/AuthFrame.vue';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
import qr from './assets/qr.svg';
const { pending, error, submit } = useRequest(spec);
const router = useRouter();
async function confirm(): Promise<void> {
  if (await submit()) await router.replace('/operations');
}
</script>
<template>
  <AuthFrame
    ><h1 class="auth-title">管理后台登录</h1>
    <p class="auth-subtitle">使用企业微信扫码，验证管理员身份。</p>
    <div class="auth-qr" data-feature="operations-wecom-login">
      <img :src="qr" alt="企业微信登录演示二维码" />
      <p>打开企业微信扫一扫，在手机上确认登录。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button :disabled="pending" @click="confirm">
        {{ pending ? '正在验证…' : '我已在手机上确认' }}
      </button>
    </div></AuthFrame
  >
</template>
