<script setup lang="ts">
import { ref } from 'vue';
import Modal from '../../shared/Modal.vue';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
import qr from './assets/qr.svg';
const { pending, error, submit } = useRequest(spec);
const open = ref(false);
const bound = ref(false);
async function bind(): Promise<void> {
  if (await submit()) {
    bound.value = true;
    open.value = false;
  }
}
</script>
<template>
  <div class="settings-row" data-feature="account-wechat-bind">
    <div>
      <h3>微信绑定</h3>
      <p>{{ bound ? '已绑定微信账号' : '绑定后可使用微信扫码登录。' }}</p>
    </div>
    <button class="secondary" :disabled="bound" @click="open = true">
      {{ bound ? '已绑定' : '绑定微信' }}
    </button>
  </div>
  <Modal v-if="open" title="绑定微信" @close="open = false"
    ><div class="auth-qr">
      <img :src="qr" alt="绑定微信演示二维码" />
      <p>使用微信扫一扫，确认绑定当前账号。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button :disabled="pending" @click="bind">{{ pending ? '正在绑定…' : '确认绑定' }}</button>
    </div></Modal
  >
</template>
