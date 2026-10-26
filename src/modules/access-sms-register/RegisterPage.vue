<script setup lang="ts">
import { ref } from 'vue';
import AuthFrame from '../../shared/product/AuthFrame.vue';
import PhoneFields from '../../shared/product/PhoneFields.vue';
import { usePhoneChallenge } from '../../shared/product/usePhoneChallenge';
import { spec } from './spec';
const { values, code, seconds, pending, error, note, send, verify, submit } =
  usePhoneChallenge(spec);
const password = ref('');
const done = ref(false);
async function register(): Promise<void> {
  if (!verify()) return;
  if (password.value.length < 8) {
    error.value = '请设置至少 8 位登录密码。';
    return;
  }
  if (await submit()) done.value = true;
}
</script>
<template>
  <AuthFrame
    ><div v-if="done" class="product-success" role="status">
      <span>✓</span>
      <h1 class="auth-title">注册成功</h1>
      <p>账号已准备就绪，现在可以登录工作台。</p>
      <RouterLink to="/access" class="button-link">前往登录</RouterLink>
    </div>
    <template v-else
      ><h1 class="auth-title">创建账号</h1>
      <p class="auth-subtitle">使用手机号码注册，开启你的工作空间。</p>
      <form
        class="auth-form"
        data-feature="access-sms-register"
        novalidate
        @submit.prevent="register"
      >
        <PhoneFields
          :phone="values.phone ?? ''"
          v-model:code="code"
          :seconds="seconds"
          :pending="pending"
          @update:phone="values.phone = $event"
          @send="send"
        />
        <p v-if="note" class="auth-hint" role="status">{{ note }}</p>
        <label
          >设置密码<input
            v-model="password"
            type="password"
            placeholder="至少 8 位字符"
            autocomplete="new-password"
        /></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button class="auth-primary" type="submit" :disabled="pending">
          {{ pending ? '正在创建…' : '注册账号' }}
        </button>
      </form>
      <div class="auth-links">
        <span>已有账号？<RouterLink to="/access">返回登录</RouterLink></span>
      </div></template
    ></AuthFrame
  >
</template>
