<script setup lang="ts">
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
const props = defineProps<{ context: { onVerified(): void } }>();
const { pending, error, reply, submit } = useRequest(spec);
async function verify(): Promise<void> {
  if (await submit()) props.context.onVerified();
}
</script>
<template>
  <div data-feature="access-captcha">
    <button
      type="button"
      class="captcha-control"
      :class="{ verified: reply }"
      :disabled="pending || !!reply"
      @click="verify"
    >
      <span aria-hidden="true">{{ reply ? '✓' : '◈' }}</span
      >{{ reply ? '安全验证已通过' : pending ? '正在验证…' : '点击完成安全验证' }}
    </button>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </div>
</template>
