<script setup lang="ts">
import { ref } from 'vue';
import { spec } from './spec';
import { useRequest } from '../../shared/product/useRequest';
import FormFields from '../../shared/product/FormFields.vue';
const { values, pending, error, submit } = useRequest(spec);
const phase = ref<'details' | 'face' | 'done'>('details');
function next(): void {
  for (const field of spec.fields) {
    const v = values[field.key]?.trim() ?? '';
    if (!v || (field.pattern && !new RegExp(field.pattern, 'u').test(v))) {
      error.value = field.hint ?? `请填写${field.label}。`;
      return;
    }
  }
  error.value = '';
  phase.value = 'face';
}
async function verify(): Promise<void> {
  if (await submit()) phase.value = 'done';
}
</script>
<template>
  <section data-feature="account-enterprise-auth">
    <RouterLink to="/account" class="back-link">← 账号设置</RouterLink>
    <div class="page-heading">
      <div>
        <p class="eyebrow">ORGANIZATION VERIFICATION</p>
        <h1>企业认证</h1>
        <p class="muted">验证企业主体与法定代表人身份。</p>
      </div>
    </div>
    <div class="product-form-layout">
      <div class="content-card product-form-panel">
        <ol class="product-steps">
          <li class="active"><span>1</span>企业资料</li>
          <li :class="{ active: phase !== 'details' }"><span>2</span>人脸核验</li>
          <li :class="{ active: phase === 'done' }"><span>3</span>认证完成</li>
        </ol>
        <form v-if="phase === 'details'" class="feature-form" novalidate @submit.prevent="next">
          <FormFields
            @change="(key, value) => (values[key] = value)"
            :fields="spec.fields"
            :values="values"
            :pending="pending"
            prefix="enterprise"
          />
          <p v-if="error" role="alert" class="form-error">{{ error }}</p>
          <div class="form-actions"><button type="submit">下一步，人脸核验</button></div>
        </form>
        <div v-else-if="phase === 'face'" class="product-success">
          <div class="face-outline" aria-hidden="true">◎</div>
          <h2>法定代表人人脸核验</h2>
          <p>请确认由法定代表人本人完成验证。演示环境将使用本地核验结果。</p>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <button :disabled="pending" @click="verify">
            {{ pending ? '正在核验…' : '开始人脸核验' }}
          </button>
        </div>
        <div v-else class="product-success" role="status">
          <span>✓</span>
          <h2>企业认证已通过</h2>
          <p>{{ values.company }} 的认证信息已更新。</p>
          <RouterLink to="/account" class="button-link">返回账号设置</RouterLink>
        </div>
      </div>
      <aside class="product-help">
        <h2>认证说明</h2>
        <p>请准备企业主体信息，并确保填写的资料与登记信息一致。</p>
        <p>本地演示不采集摄像头或上传真实人脸信息。</p>
      </aside>
    </div>
  </section>
</template>
