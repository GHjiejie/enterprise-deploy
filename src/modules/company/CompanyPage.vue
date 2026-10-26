<script setup lang="ts">
import { company } from './mock';
const sample = `// ${company.brand} SDK 示例（Mock）\nconst baseURL = 'https://${company.domain}/api';`;
const email = `您好，欢迎使用 ${company.brand}。\n使用文档：${company.docs}\n${company.filing}`;
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">BRAND & DOCUMENTATION</p>
        <h1>主体与品牌</h1>
        <p class="muted">企业主体、开发接入与通知模板。</p>
      </div>
    </div>
    <div class="company-panels">
      <article class="content-card">
        <h2>公司主体信息</h2>
        <dl class="detail-grid">
          <dt>品牌</dt>
          <dd>{{ company.brand }}</dd>
          <dt>备案号</dt>
          <dd>{{ company.filing }}</dd>
          <dt>域名</dt>
          <dd>{{ company.domain }}</dd>
          <dt>文档外链</dt>
          <dd>{{ company.docs }}</dd>
        </dl>
      </article>
      <article class="content-card">
        <h2>示例代码</h2>
        <pre>{{ sample }}</pre>
      </article>
      <article class="content-card">
        <h2>邮件模板</h2>
        <pre>{{ email }}</pre>
      </article>
    </div>
  </section>
</template>
