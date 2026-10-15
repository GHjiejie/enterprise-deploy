import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAccess } from '../../app/page-context.tsx';
import { buildProfile } from '../../platform/features.ts';
import { resolveModuleLink } from '../../platform/navigation-service.ts';
import { catalogModels, moduleLabels } from '../../shared/model-data.ts';
import { ModuleLink } from '../../shared/module-link.tsx';
import type { ModuleId } from '../../../shared/build-profile.ts';

const history: readonly { moduleId: ModuleId; title: string; taskId?: string }[] = [
  { moduleId: 'chat', title: '工作计划讨论' },
  { moduleId: 'imageStudio', title: '产品视觉探索', taskId: 'demo-image-01' },
  { moduleId: 'videoStudio', title: '品牌短片创意', taskId: 'demo-video-01' },
];

export default function ModelCatalogPage() {
  const access = useAccess();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const results = catalogModels.filter((model) =>
    `${model.name} ${model.description} ${model.tags.join(' ')}`.includes(query.trim()),
  );
  const entryResults = results.flatMap((model) => {
    const link = resolveModuleLink(model.moduleId, buildProfile, access);
    return link.available ? [{ model, href: link.href }] : [];
  });

  return (
    <section data-testid="catalog-page">
      <div className="hero">
        <p className="eyebrow">YOUR ENTERPRISE AI WORKSPACE</p>
        <h1>让每一个想法，更进一步</h1>
        <p>发现适合业务的模型，在一个工作台开启智能协作。</p>
        <div className="quick-links" aria-label="快捷入口">
          <ModuleLink moduleId="chat">
            开始对话 <span aria-hidden="true">↗</span>
          </ModuleLink>
          <ModuleLink moduleId="imageStudio" className="button secondary">
            图片创作
          </ModuleLink>
          <ModuleLink moduleId="videoStudio" className="button secondary">
            视频创作
          </ModuleLink>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          ✳
        </div>
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">MODEL COLLECTION</p>
          <h2>模型广场</h2>
        </div>
        <label className="search">
          {' '}
          <span className="sr-only">搜索模型与体验入口</span>
          <input
            type="search"
            placeholder="搜索模型与体验入口"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {results.length ? (
        <div className="model-grid">
          {results.map((model) => (
            <article
              className="model-card"
              key={model.id}
              data-testid={`model-${model.capability}`}
            >
              <div className={`model-icon ${model.capability}`} aria-hidden="true">
                {model.capability === 'text' ? 'Aa' : model.capability === 'image' ? '▧' : '▷'}
              </div>
              <h3>{model.name}</h3>
              <p>{model.description}</p>
              <div className="tags">
                {model.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="card-footer">
                <span>演示模型</span>
                <ModuleLink moduleId={model.moduleId} className="text-link">
                  在线体验 →
                </ModuleLink>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">没有匹配的模型，请尝试其他关键词。</p>
      )}
      {query.trim() && (
        <div className="panel search-results" role="region" aria-label="体验搜索结果">
          <h3>可用体验入口</h3>
          {entryResults.length ? (
            entryResults.map(({ model, href }) => (
              <Link key={model.id} to={href}>
                {moduleLabels[model.moduleId]} →
              </Link>
            ))
          ) : (
            <p>没有匹配的可用体验入口。</p>
          )}
        </div>
      )}
      <div className="section-heading">
        <div>
          <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
          <h2>最近访问</h2>
        </div>
        <span className="muted">演示历史记录</span>
      </div>
      <div className="history-list">
        {history.map((item) => (
          <button
            key={item.moduleId}
            type="button"
            onClick={() => {
              const link = resolveModuleLink(item.moduleId, buildProfile, access);
              if (!link.available) {
                setNotice(link.message);
                return;
              }
              setNotice('');
              navigate(item.taskId ? `${link.href}/tasks/${item.taskId}` : link.href);
            }}
          >
            <span>{item.title}</span>
            <span className="muted">
              {moduleLabels[item.moduleId]} <span aria-hidden="true">↗</span>
            </span>
          </button>
        ))}
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
