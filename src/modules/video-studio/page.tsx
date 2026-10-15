import { useState } from 'react';
import { usePageParams } from '../../app/page-context.tsx';
import { ComposeForm } from '../../shared/compose-form.tsx';
import { StudioLayout } from '../../shared/studio-layout.tsx';
import './styles.css';

export default function VideoStudioPage() {
  const { taskId } = usePageParams();
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('');
  return (
    <StudioLayout
      testId="video-studio"
      className="video-studio-page"
      title="视频生成"
      introduction="描述你的灵感，探索新的表达方式。"
    >
      {taskId ? (
        <div className="panel">
          <h2>任务详情</h2>
          <p>演示任务：{taskId}</p>
          <p className="muted">尚未连接任务接口，暂不提供实际任务数据。</p>
        </div>
      ) : (
        <ComposeForm
          prompt={prompt}
          onPromptChange={setPrompt}
          onSubmit={() => setMessage('已完成本地输入校验。尚未连接生成服务，未创建任务。')}
          inputLabel="创作描述"
          placeholder="描述你希望生成的视频…"
          submitLabel="检查创作输入"
          message={message}
        />
      )}
    </StudioLayout>
  );
}
