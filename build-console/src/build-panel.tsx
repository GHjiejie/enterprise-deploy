import type { BuildJob, ConsoleModule, ReleaseMode } from '../../shared/build-console.ts';

export const modeLabels: Readonly<Record<ReleaseMode, string>> = {
  staging: '预发布环境',
  production: '生产环境',
};

export function isJobActive(job: BuildJob | null): boolean {
  return job?.status === 'queued' || job?.status === 'running';
}

interface BuildPanelProps {
  readonly job: BuildJob | null;
  readonly modules: readonly ConsoleModule[];
  readonly pollError: string | null;
}

export function BuildPanel({ job, modules, pollError }: BuildPanelProps) {
  if (!job) {
    return (
      <section className="build-panel surface" aria-labelledby="build-heading">
        <div className="section-title">
          <span className="step-number">03</span>
          <div>
            <h2 id="build-heading">构建结果</h2>
            <p>保存并构建后，在这里预览和下载。</p>
          </div>
        </div>
        <div className="build-empty">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="m24 5 17 10v18L24 43 7 33V15L24 5Z" />
            <path d="m7 15 17 10 17-10M24 25v18M15 10l17 10" />
          </svg>
          <strong>准备好你的企业版本</strong>
          <p>选择需要开放的模块，生成独立交付包。</p>
        </div>
      </section>
    );
  }

  const status = {
    queued: { label: '等待构建', hint: '企业配置已保存，即将开始构建。', symbol: '…' },
    running: { label: '正在构建', hint: '正在校验配置、编译并生成交付包，请稍候。', symbol: '…' },
    succeeded: { label: '构建成功', hint: '企业版本已就绪，可以预览或下载交付。', symbol: '✓' },
    failed: {
      label: '构建失败',
      hint: '配置已保存。查看下方日志，修复后可重新构建。',
      symbol: '!',
    },
  }[job.status];
  const enabledModules = modules.filter((module) => job.profile.modules[module.id]);

  return (
    <section className={`build-panel surface status-${job.status}`} aria-labelledby="build-heading">
      <div className="section-title">
        <span className="step-number">03</span>
        <div>
          <h2 id="build-heading">构建结果</h2>
          <p>当前任务 · {job.profile.id}</p>
        </div>
      </div>
      <div className="job-status" role="status" aria-live="polite">
        <span className="job-symbol" aria-hidden="true">
          {status.symbol}
        </span>
        <div>
          <strong>{status.label}</strong>
          <p>{status.hint}</p>
        </div>
      </div>
      <div className="job-context">
        <span>{job.profile.id}</span>
        <span>{modeLabels[job.mode]}</span>
        <span>{enabledModules.length} 个模块</span>
      </div>
      {pollError && (
        <p className="poll-notice" role="alert">
          暂时无法获取构建状态，正在自动重试。{pollError}
        </p>
      )}
      {job.error && (
        <p className="inline-error" role="alert">
          {job.error}
        </p>
      )}
      {job.status === 'succeeded' && job.result && (
        <div className="build-result" data-testid="build-result">
          <dl className="result-details">
            <div>
              <dt>启用模块</dt>
              <dd>{enabledModules.map((module) => module.label).join('、')}</dd>
            </div>
            <div>
              <dt>产物目录</dt>
              <dd>
                <code>{job.result.outDir}</code>
              </dd>
            </div>
          </dl>
          <div className="result-actions">
            <a
              className="button primary"
              href={job.result.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              预览构建结果 <span aria-hidden="true">↗</span>
            </a>
            <a className="button secondary" href={job.result.downloadUrl}>
              下载交付包 <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="package-name">{job.result.packageName}</p>
          <details className="record-details">
            <summary>查看构建记录</summary>
            <dl className="result-details">
              <div>
                <dt>构建 ID</dt>
                <dd>
                  <code>{job.result.buildId}</code>
                </dd>
              </div>
              <div>
                <dt>制品摘要</dt>
                <dd>
                  <code>{job.result.artifactDigest}</code>
                </dd>
              </div>
            </dl>
          </details>
        </div>
      )}
      <details className="build-logs" open={isJobActive(job) || job.status === 'failed'}>
        <summary>构建日志</summary>
        <pre data-testid="build-log" tabIndex={0} aria-label="构建日志内容">
          {job.log || '任务已创建，等待输出…'}
        </pre>
      </details>
      {isJobActive(job) && (
        <p className="build-lock-note">构建期间暂时锁定配置，完成后可继续编辑。</p>
      )}
    </section>
  );
}
