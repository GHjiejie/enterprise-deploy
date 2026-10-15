import { useState } from 'react';
import { UploadField } from '../../shared/upload-field.tsx';

export default function ChatPage() {
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('');
  return (
    <section data-testid="chat-page">
      <p className="eyebrow">AI ASSISTANT</p>
      <h1>智能对话</h1>
      <p className="page-intro">从一个问题开始，让灵感与效率一起发生。</p>
      <form
        className="panel compose"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage('本地演示：输入已保留，尚未连接对话服务。');
        }}
      >
        <label htmlFor="chat-prompt">你的问题</label>
        <textarea
          id="chat-prompt"
          required
          rows={5}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="帮我梳理今天的工作思路…"
        />
        <UploadField />
        <div>
          <button className="button" type="submit" disabled={!prompt.trim()}>
            检查对话输入
          </button>
        </div>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
