<script setup lang="ts">
import type { MockActionSpec } from '../../contracts/mock';
import { useRequest } from './useRequest';
import FormFields from './FormFields.vue';
const props = defineProps<{
  spec: MockActionSpec;
  back: string;
  backLabel: string;
  steps?: readonly string[];
}>();
const { values, pending, error, reply, submit } = useRequest(props.spec);
</script>
<template>
  <section class="product-detail-page" :data-feature="spec.id">
    <RouterLink :to="back" class="back-link">← {{ backLabel }}</RouterLink>
    <div class="page-heading">
      <div>
        <p class="eyebrow">ACCOUNT SERVICES</p>
        <h1>{{ spec.title }}</h1>
        <p class="muted">{{ spec.description }}</p>
      </div>
    </div>
    <div class="product-form-layout">
      <div class="content-card product-form-panel">
        <ol v-if="steps" class="product-steps">
          <li v-for="(step, index) in steps" :key="step" :class="{ active: reply || index === 0 }">
            <span>{{ reply ? '✓' : index + 1 }}</span
            >{{ step }}
          </li>
        </ol>
        <div v-if="reply" class="product-success" role="status">
          <span aria-hidden="true">✓</span>
          <h2>已提交成功</h2>
          <p>{{ reply.message }}</p>
          <RouterLink :to="back" class="button-link">{{ backLabel }}</RouterLink>
        </div>
        <form v-else class="feature-form" novalidate @submit.prevent="submit">
          <FormFields
            @change="(key, value) => (values[key] = value)"
            :fields="spec.fields"
            :values="values"
            :pending="pending"
            :prefix="spec.id"
          />
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <div class="form-actions">
            <RouterLink :to="back" class="text-action">取消</RouterLink
            ><button type="submit" :disabled="pending">
              {{ pending ? '正在提交…' : spec.button }}
            </button>
          </div>
        </form>
      </div>
      <aside class="product-help">
        <h2>办理须知</h2>
        <p>请准确填写信息，提交后可在当前页面查看处理结果。</p>
        <p>当前为演示环境，信息仅保留在本次页面会话中。</p>
      </aside>
    </div>
  </section>
</template>
