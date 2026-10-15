import type { ConsoleModule } from '../../shared/build-console.ts';
import type { ModuleId } from '../../shared/build-profile.ts';

const icons: Readonly<Record<ModuleId, string>> = {
  modelCatalog: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  chat: 'M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-5 3V11.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5ZM8 9h7M8 13h5',
  imageStudio: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M16 8h.01',
  videoStudio: 'M4 5h16v14H4zM10 9l5 3-5 3V9Z',
};
const descriptions: Readonly<Record<ModuleId, string>> = {
  modelCatalog: '浏览模型目录，查看模型介绍与能力。',
  chat: '使用智能对话，保留图片和文件上传能力。',
  imageStudio: '开放图片生成页面和在线体验入口。',
  videoStudio: '开放视频生成页面和在线体验入口。',
};

interface ModuleCardProps {
  readonly module: ConsoleModule;
  readonly checked: boolean;
  readonly dependencyLabels: readonly string[];
  readonly onChange: (checked: boolean) => void;
}

export function ModuleCard({ module, checked, dependencyLabels, onChange }: ModuleCardProps) {
  return (
    <label className={`module-card ${checked ? 'selected' : ''}`}>
      <div className="module-card-top">
        <span className={`module-icon icon-${module.id}`}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={icons[module.id]} />
          </svg>
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={module.label}
        />
      </div>
      <strong>{module.label}</strong>
      <p>{descriptions[module.id]}</p>
      <div className="module-card-bottom">
        <span className={checked ? 'module-state enabled' : 'module-state'}>
          <span aria-hidden="true">{checked ? '✓' : '−'}</span> {checked ? '已启用' : '未启用'}
        </span>
        {dependencyLabels.length > 0 && <small>依赖 {dependencyLabels.join('、')}</small>}
      </div>
    </label>
  );
}
