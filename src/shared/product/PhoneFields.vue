<script setup lang="ts">
defineProps<{ phone: string; code: string; seconds: number; pending: boolean }>();
const emit = defineEmits<{ 'update:phone': [string]; 'update:code': [string]; send: [] }>();
</script>
<template>
  <label
    >手机号码<input
      :value="phone"
      type="tel"
      autocomplete="tel"
      placeholder="请输入手机号码"
      :disabled="pending"
      @input="emit('update:phone', ($event.target as HTMLInputElement).value)" /></label
  ><label
    >短信验证码
    <div class="phone-code-field">
      <input
        :value="code"
        inputmode="numeric"
        autocomplete="one-time-code"
        placeholder="请输入验证码"
        maxlength="6"
        :disabled="pending"
        @input="emit('update:code', ($event.target as HTMLInputElement).value)"
      /><button type="button" :disabled="pending || seconds > 0" @click="emit('send')">
        {{ seconds ? `${seconds}s 后重发` : '获取验证码' }}
      </button>
    </div></label
  >
</template>
