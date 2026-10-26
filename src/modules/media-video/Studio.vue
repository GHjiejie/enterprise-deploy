<script setup lang="ts">
import { inject, onBeforeUnmount, ref } from 'vue';
import { mediaWorkspaceKey } from '../../contracts/customer';
import { useRequest } from '../../shared/product/useRequest';
import { spec } from './spec';
const { values, pending, error, submit } = useRequest(spec);
const workspace = inject(mediaWorkspaceKey);
const url = ref('');
const rendering = ref(false);
let recorder: MediaRecorder | undefined;
let stream: MediaStream | undefined;
let frame: number | undefined;
let disposed = false;

async function generate(): Promise<void> {
  if (rendering.value || !(await submit())) return;
  rendering.value = true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器无法生成视频预览。');
    stream = canvas.captureStream(24);
    recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    let start = 0;
    function draw(time: number): void {
      if (!ctx) return;
      if (!start) start = time;
      const progress = Math.min((time - start) / 1000, 1);
      ctx.fillStyle = '#dae6f4';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#f7d4b7';
      ctx.beginPath();
      ctx.arc(320 + progress * 35, 145, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7da5ac';
      ctx.fillRect(0, 220, 640, 140);
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      for (let i = 0; i < 6; i++)
        ctx.fillRect(40 + i * 100 + progress * 20, 260 + (i % 2) * 30, 60, 3);
      if (progress < 1) frame = requestAnimationFrame(draw);
      else recorder?.stop();
    }
    await new Promise<void>((resolve, reject) => {
      if (!recorder) return reject(new Error('视频预览不可用。'));
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('视频生成失败，请重试。'));
      recorder.start();
      frame = requestAnimationFrame(draw);
    });
    stream.getTracks().forEach((track) => track.stop());
    if (disposed) return;
    url.value = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));

    workspace?.add({
      id: crypto.randomUUID(),
      name: '海岸短片.webm',
      kind: '视频',
      url: url.value,
    });
  } catch (cause) {
    if (!disposed) error.value = cause instanceof Error ? cause.message : '视频生成失败，请重试。';
  } finally {
    if (!disposed) rendering.value = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  if (frame) cancelAnimationFrame(frame);
  if (recorder?.state === 'recording') recorder.stop();
  stream?.getTracks().forEach((track) => track.stop());
});
</script>
<template>
  <div class="content-card studio-layout" data-feature="media-video">
    <form class="feature-form" @submit.prevent="generate">
      <h2>视频创作</h2>
      <label
        >视频描述<textarea v-model="values.prompt" placeholder="描述场景、主体与镜头运动" /></label
      ><label
        >视频比例<select>
          <option>16:9 横屏</option>
        </select></label
      >
      <p class="muted">演示环境将生成一段可播放、可下载的本地短片。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button type="submit" :disabled="pending || rendering">
        {{ pending || rendering ? '正在生成…' : '生成视频' }}
      </button>
    </form>
    <div class="studio-preview">
      <template v-if="url"
        ><video :src="url" controls aria-label="生成的视频预览" /><a
          :href="url"
          download="海岸短片.webm"
          class="text-action"
          >下载视频</a
        >
        <p role="status">视频已生成</p></template
      ><template v-else
        ><span class="preview-symbol" aria-hidden="true">▷</span>
        <p>{{ rendering ? '正在渲染预览…' : '生成后即可预览和下载' }}</p></template
      >
    </div>
  </div>
</template>
