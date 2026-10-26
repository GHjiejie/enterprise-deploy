<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
import qr from './assets/qr.svg';
const { pending, error, submit } = useRequest(spec);
const router = useRouter();
async function confirm(): Promise<void> {
  if (await submit()) await router.replace('/');
}
</script>
<template>
  <div class="auth-qr" data-feature="access-wechat-login">
    <img :src="qr" alt="微信登录演示二维码" />
    <p>打开微信扫一扫，在手机上确认登录</p>
    <p class="auth-hint">演示环境请点击下方按钮完成确认。</p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <button type="button" class="auth-primary" :disabled="pending" @click="confirm">
      {{ pending ? '正在确认…' : '我已在手机上确认' }}
    </button>
  </div>
</template>
