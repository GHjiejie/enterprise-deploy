import { useState } from 'react';
import { usePageParams } from '../app/page-context.tsx';
import { UploadField } from './upload-field.tsx';

export function StudioPage({ kind }: { kind: 'image' | 'video' }) {
  const { taskId } = usePageParams();
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('');
  const label = kind === 'image' ? '图片' : '视频';
  return (
    <section data-testid={`${kind}-studio`}>
      <p className="eyebrow">CREATIVE STUDIO</p>
      <h1>{label}生成</h1>
      <p className="page-intro">描述你的灵感，探索新的表达方式。</p>
      {taskId ? (
        <div className="panel">
          <h2>任务详情</h2>
          <p>演示任务：{taskId}</p>
          <p className="muted">尚未连接任务接口，暂不提供实际任务数据。</p>
        </div>
      ) : (
        <form
          className="panel compose"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage('已完成本地输入校验。尚未连接生成服务，未创建任务。');
          }}
        >
          <label htmlFor="studio-prompt">创作描述</label>
          <textarea
            id="studio-prompt"
            required
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={`描述你希望生成的${label}…`}
            rows={5}
          />
          <UploadField />
          <div>
            <button className="button" type="submit" disabled={!prompt.trim()}>
              检查创作输入
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </form>
      )}
    </section>
  );
}
