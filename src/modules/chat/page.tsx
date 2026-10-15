import { useState } from 'react';
import { ComposeForm } from '../../shared/compose-form.tsx';
import './styles.css';

export default function ChatPage() {
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('');
  return (
    <section data-testid="chat-page" className="chat-page">
      <p className="eyebrow">AI ASSISTANT</p>
      <h1>智能对话</h1>
      <p className="page-intro">从一个问题开始，让灵感与效率一起发生。</p>
      <ComposeForm
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={() => setMessage('本地演示：输入已保留，尚未连接对话服务。')}
        inputLabel="你的问题"
        placeholder="帮我梳理今天的工作思路…"
        submitLabel="检查对话输入"
        message={message}
      />
    </section>
  );
}
