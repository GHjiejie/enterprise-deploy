<script setup lang="ts">
import { ref } from 'vue';
import AuthFrame from '../../shared/product/AuthFrame.vue';
import PhoneFields from '../../shared/product/PhoneFields.vue';
import { usePhoneChallenge } from '../../shared/product/usePhoneChallenge';
import { spec } from './spec';
const { values, code, seconds, pending, error, note, send, verify, submit } =
  usePhoneChallenge(spec);
const password = ref('');
const confirmation = ref('');
const done = ref(false);
async function recover(): Promise<void> {
  if (!verify()) return;
  if (password.value.length < 8) {
    error.value = '新密码至少需要 8 位字符。';
    return;
  }
  if (password.value !== confirmation.value) {
    error.value = '两次输入的密码不一致。';
    return;
  }
  if (await submit()) done.value = true;
}
</script>
<template>
  <AuthFrame
    ><div v-if="done" class="product-success" role="status">
      <span>✓</span>
      <h1 class="auth-title">密码已重置</h1>
      <p>请使用新密码重新登录。</p>
      <RouterLink to="/access" class="button-link">返回登录</RouterLink>
    </div>
    <template v-else
      ><h1 class="auth-title">找回密码</h1>
      <p class="auth-subtitle">验证手机号码后，重新设置登录密码。</p>
      <form
        class="auth-form"
        data-feature="access-sms-recover"
        novalidate
        @submit.prevent="recover"
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
          >新密码<input
            v-model="password"
            type="password"
            placeholder="至少 8 位字符"
            autocomplete="new-password" /></label
        ><label
          >确认新密码<input
            v-model="confirmation"
            type="password"
            placeholder="再次输入新密码"
            autocomplete="new-password"
        /></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button class="auth-primary" type="submit" :disabled="pending">
          {{ pending ? '正在重置…' : '重置密码' }}
        </button>
      </form>
      <div class="auth-links"><RouterLink to="/access">← 返回登录</RouterLink></div></template
    ></AuthFrame
  >
</template>
