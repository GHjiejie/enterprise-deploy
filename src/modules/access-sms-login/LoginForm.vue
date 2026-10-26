<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useRuntime } from '../../core/runtime';
import ExtensionPoint from '../../shared/ExtensionPoint.vue';
import PhoneFields from '../../shared/product/PhoneFields.vue';
import { usePhoneChallenge } from '../../shared/product/usePhoneChallenge';
import { spec } from './spec';
const { values, code, seconds, pending, error, note, send, verify, submit } =
  usePhoneChallenge(spec);
const router = useRouter();
const runtime = useRuntime();
const verified = ref(false);
const agreed = ref(true);
const needsChallenge = computed(() =>
  runtime.extensions.accessTools.some(
    ({ owner, value }) => value.group === 'challenge' && runtime.can(owner, value.permission),
  ),
);
async function login(): Promise<void> {
  if (!verify()) return;
  if (needsChallenge.value && !verified.value) {
    error.value = '请先完成安全验证。';
    return;
  }
  if (!agreed.value) {
    error.value = '请先确认演示环境说明。';
    return;
  }
  if (await submit()) await router.replace('/');
}
</script>
<template>
  <form class="auth-form" data-feature="access-sms-login" novalidate @submit.prevent="login">
    <PhoneFields
      :phone="values.phone ?? ''"
      v-model:code="code"
      :seconds="seconds"
      :pending="pending"
      @update:phone="values.phone = $event"
      @send="send"
    />
    <p v-if="note" class="auth-hint" role="status">{{ note }}</p>
    <ExtensionPoint
      slot="accessTools"
      group="challenge"
      :context="{ onVerified: () => (verified = true) }"
    /><label class="auth-agreement"
      ><input v-model="agreed" type="checkbox" />我已了解当前为本地演示环境</label
    >
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <button class="auth-primary" type="submit" :disabled="pending">
      {{ pending ? '正在登录…' : '登录工作台' }}
    </button>
  </form>
</template>
