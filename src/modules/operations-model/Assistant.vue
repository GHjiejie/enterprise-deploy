<script setup lang="ts">
import { ref } from 'vue';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
const { values, pending, error, submit } = useRequest(spec);
const messages = ref<readonly { id: string; role: 'user' | 'assistant'; text: string }[]>([]);
async function send(): Promise<void> {
  const question = values.question?.trim() ?? '';
  if (!question || pending.value) return;
  const result = await submit();
  if (result) {
    messages.value = [
      ...messages.value,
      { id: crypto.randomUUID(), role: 'user', text: question },
      { id: crypto.randomUUID(), role: 'assistant', text: result.message },
    ];
    values.question = '';
  }
}
function suggest(text: string): void {
  values.question = text;
}
</script>
<template>
  <div class="assistant-workspace content-card" data-feature="operations-model">
    <header>
      <div class="assistant-logo">✧</div>
      <div>
        <h2>Hermes 智能助手</h2>
        <p>你的运维协作伙伴</p>
      </div>
      <span class="status-badge">在线</span>
    </header>
    <div class="assistant-messages">
      <div v-if="!messages.length" class="assistant-welcome">
        <span>✧</span>
        <h2>今天有什么可以帮你？</h2>
        <p>查询服务状态、分析异常，或获取处理建议。</p>
        <div>
          <button
            v-for="text in ['查看当前服务状态', '分析最近的告警', '检查接口响应时间']"
            :key="text"
            class="secondary"
            @click="suggest(text)"
          >
            {{ text }} ↗
          </button>
        </div>
      </div>
      <div
        v-for="message in messages"
        :key="message.id"
        class="assistant-message"
        :class="message.role"
      >
        <small>{{ message.role === 'user' ? '你' : 'Hermes' }}</small>
        <p>{{ message.text }}</p>
      </div>
      <p v-if="pending" class="muted" role="status">Hermes 正在分析…</p>
    </div>
    <form class="assistant-composer" @submit.prevent="send">
      <label
        ><span class="sr-only">你的问题</span
        ><textarea
          v-model="values.question"
          placeholder="描述你遇到的问题，或询问服务状态…"
          :disabled="pending"
        /></label
      ><button type="submit" :disabled="pending || !values.question?.trim()">
        {{ pending ? '分析中…' : '发送' }}
      </button>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <small>回复来自本地演示数据，供体验与交互验证。</small>
    </form>
  </div>
</template>
