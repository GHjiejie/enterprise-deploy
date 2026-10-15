import { useEffect, useState } from 'react';
import type { ModuleId } from '../../shared/build-profile.ts';
import type {
  BuildJob,
  ConsoleBootstrap,
  ProfileEntry,
  ReleaseMode,
} from '../../shared/build-console.ts';
import { ConsoleRequestError, consoleApi, errorMessage, isAbortError } from './api.ts';
import { BuildPanel, isJobActive, modeLabels } from './build-panel.tsx';
import { draftMatchesProfile, newDraft, toProfile, validateDraft } from './draft.ts';
import type { ProfileDraft } from './draft.ts';
import { ModuleCard } from './module-card.tsx';

function ConsoleHeader() {
  return (
    <header className="console-header">
      <a className="brand" href="/" aria-label="企业构建控制台首页">
        <span className="brand-symbol" aria-hidden="true">
          e
        </span>
        <span>
          Enterprise <span className="brand-caption">BUILD CONSOLE</span>
        </span>
      </a>
      <div className="local-indicator">
        <span aria-hidden="true" /> 本地构建工具
      </div>
    </header>
  );
}

export function App() {
  const [bootstrap, setBootstrap] = useState<ConsoleBootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    void consoleApi.bootstrap(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setBootstrap(data);
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setLoadError(errorMessage(error));
        }
      },
    );
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="console-shell">
      <ConsoleHeader />
      {bootstrap ? (
        <ConsoleWorkspace bootstrap={bootstrap} />
      ) : (
        <main className="startup-state surface">
          {loadError ? (
            <>
              <span className="startup-icon" aria-hidden="true">
                !
              </span>
              <h1>暂时无法读取企业配置</h1>
              <p role="alert">{loadError}</p>
              <button className="button primary" onClick={() => setAttempt((value) => value + 1)}>
                重新加载
              </button>
            </>
          ) : (
            <p role="status">正在读取企业配置…</p>
          )}
        </main>
      )}
      <footer className="console-footer">
        Enterprise Build Console <span>配置在本次构建中固定，修改后重新构建生效。</span>
      </footer>
    </div>
  );
}

type PendingAction = 'save' | 'build' | 'reload' | null;
interface FormError {
  readonly message: string;
  readonly conflict: boolean;
}

function ConsoleWorkspace({ bootstrap }: { readonly bootstrap: ConsoleBootstrap }) {
  const initialEntry = bootstrap.profiles[0] ?? null;
  const [profiles, setProfiles] = useState(bootstrap.profiles);
  const [selectedEntry, setSelectedEntry] = useState<ProfileEntry | null>(initialEntry);
  const [draft, setDraft] = useState<ProfileDraft>(initialEntry?.profile ?? newDraft());
  const [mode, setMode] = useState<ReleaseMode>('production');
  const [pending, setPending] = useState<PendingAction>(null);
  const [formError, setFormError] = useState<FormError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<BuildJob | null>(bootstrap.activeJob);
  const [pollError, setPollError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const { modules } = bootstrap;
  const isNew = selectedEntry === null;
  const dirty = selectedEntry ? !draftMatchesProfile(draft, selectedEntry.profile) : touched;
  const active = isJobActive(job);
  const disabled = pending !== null || active;
  const errors = validateDraft(draft, modules, profiles, isNew);
  const enabledModules = modules.filter((module) => draft.modules[module.id]);
  const defaultLabel = modules.find((module) => module.id === draft.defaultModule)?.label;

  useEffect(() => {
    if (!job || !isJobActive(job)) return;
    const jobId = job.id;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const updated = await consoleApi.job(jobId, controller.signal);
        if (controller.signal.aborted) return;
        setJob((current) => (current?.id === jobId ? updated : current));
        setPollError(null);
        if (isJobActive(updated))
          timer = setTimeout(() => {
            void poll();
          }, 1000);
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        setPollError(errorMessage(error));
        timer = setTimeout(() => {
          void poll();
        }, 1000);
      }
    }
    timer = setTimeout(() => {
      void poll();
    }, 1000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [job?.id, job?.status]);

  function selectProfile(id: string) {
    if (dirty && !window.confirm('当前配置有未保存的修改，是否放弃修改并切换？')) return;
    const entry = profiles.find((item) => item.profile.id === id) ?? null;
    setSelectedEntry(entry);
    setDraft(entry?.profile ?? newDraft());
    setTouched(false);
    setFormError(null);
    setNotice(null);
  }

  function editDraft(next: ProfileDraft) {
    setDraft(next);
    setTouched(true);
    setFormError(null);
    setNotice(null);
  }

  function toggleModule(id: ModuleId, checked: boolean) {
    editDraft({
      ...draft,
      modules: { ...draft.modules, [id]: checked },
      defaultModule: !checked && draft.defaultModule === id ? '' : draft.defaultModule,
    });
  }

  function acceptSaved(entry: ProfileEntry) {
    setProfiles((current) =>
      [...current.filter((item) => item.profile.id !== entry.profile.id), entry].sort((a, b) =>
        a.profile.id.localeCompare(b.profile.id),
      ),
    );
    setSelectedEntry(entry);
    setDraft(entry.profile);
    setTouched(false);
  }

  function captureError(error: unknown) {
    setFormError({
      message: errorMessage(error),
      conflict: error instanceof ConsoleRequestError && error.code === 'conflict',
    });
    if (error instanceof ConsoleRequestError && error.code === 'build_busy') {
      const controller = new AbortController();
      void consoleApi.bootstrap(controller.signal).then(
        (data) => {
          if (data.activeJob) setJob(data.activeJob);
        },
        () => undefined,
      );
    }
  }

  async function submit(build: boolean) {
    const profile = toProfile(draft);
    if (disabled || errors.length > 0 || !profile) return;
    setPending(build ? 'build' : 'save');
    setFormError(null);
    setNotice(null);
    try {
      const request = { profile, expectedRevision: selectedEntry?.revision ?? null };
      if (build) {
        const response = await consoleApi.build({ ...request, mode });
        acceptSaved(response.entry);
        setPollError(null);
        setJob(response.job);
      } else {
        acceptSaved(await consoleApi.save(profile.id, request));
        setNotice(`企业配置 ${profile.id} 已保存。下次构建将使用这份配置。`);
      }
    } catch (error) {
      captureError(error);
    } finally {
      setPending(null);
    }
  }

  async function reloadPersisted() {
    if (dirty && !window.confirm('重新加载会放弃当前未保存的修改，是否继续？')) return;
    setPending('reload');
    const controller = new AbortController();
    try {
      const data = await consoleApi.bootstrap(controller.signal);
      setProfiles(data.profiles);
      const entry =
        data.profiles.find((item) => item.profile.id === draft.id) ?? data.profiles[0] ?? null;
      setSelectedEntry(entry);
      setDraft(entry?.profile ?? newDraft());
      setTouched(false);
      setFormError(null);
      setNotice('已重新加载保存的企业配置。');
      if (data.activeJob) setJob(data.activeJob);
    } catch (error) {
      captureError(error);
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="console-main">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ENTERPRISE DELIVERY</p>
          <h1>配置你的企业版本</h1>
          <p className="page-description">选择模块，一键构建专属工作台。</p>
        </div>
        <div className="heading-note">
          <span aria-hidden="true">◈</span>
          <div>
            每个企业，独立交付<small>配置 → 构建 → 预览与下载</small>
          </div>
        </div>
      </div>
      <div className="console-layout">
        <form
          className="configuration"
          data-testid="console-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(true);
          }}
        >
          {formError && (
            <div className="form-feedback error" role="alert">
              <strong>操作未完成</strong>
              <p>{formError.message}</p>
              {formError.conflict && (
                <button
                  type="button"
                  className="text-button"
                  disabled={disabled}
                  onClick={() => {
                    void reloadPersisted();
                  }}
                >
                  重新加载已保存配置
                </button>
              )}
            </div>
          )}
          {notice && (
            <div className="form-feedback success" role="status">
              {notice}
            </div>
          )}
          <fieldset disabled={disabled} className="configuration-fields">
            <section className="surface profile-section" aria-labelledby="profile-heading">
              <div className="section-heading-row">
                <div className="section-title">
                  <span className="step-number">01</span>
                  <div>
                    <h2 id="profile-heading">选择企业</h2>
                    <p>编辑已有版本，或创建新的企业配置。</p>
                  </div>
                </div>
                <span className={`save-state ${dirty ? 'unsaved' : ''}`}>
                  {isNew ? '新配置' : dirty ? '未保存修改' : '已保存'}
                </span>
              </div>
              <div className="profile-fields">
                <label className="field">
                  <span>企业配置</span>
                  <select
                    value={selectedEntry?.profile.id ?? '__new__'}
                    onChange={(event) => selectProfile(event.target.value)}
                  >
                    {profiles.map((entry) => (
                      <option key={entry.profile.id} value={entry.profile.id}>
                        {entry.profile.id}
                      </option>
                    ))}
                    <option value="__new__">新建企业</option>
                  </select>
                </label>
                {isNew ? (
                  <label className="field">
                    <span>企业标识</span>
                    <input
                      value={draft.id}
                      placeholder="enterprise-c"
                      maxLength={64}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => editDraft({ ...draft, id: event.target.value })}
                      aria-describedby="profile-id-hint"
                    />
                    <small id="profile-id-hint">小写字母、数字和短横线，保存后作为独立配置。</small>
                  </label>
                ) : (
                  <div className="profile-explanation">
                    <span className="profile-mini-icon" aria-hidden="true">
                      E
                    </span>
                    <div>
                      <strong>{selectedEntry.profile.id}</strong>
                      <p>修改模块后，重新构建该企业版本。</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
            <section className="surface modules-section" aria-labelledby="modules-heading">
              <div className="section-heading-row">
                <div className="section-title">
                  <span className="step-number">02</span>
                  <div>
                    <h2 id="modules-heading">配置开放模块</h2>
                    <p>企业版本中的导航、页面与体验入口将同步生效。</p>
                  </div>
                </div>
                <span className="module-count">
                  已启用 <strong>{enabledModules.length}</strong> / {modules.length}
                </span>
              </div>
              <div className="module-grid">
                {modules.map((module) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    checked={draft.modules[module.id]}
                    dependencyLabels={module.dependsOn.map(
                      (id) => modules.find((item) => item.id === id)?.label ?? id,
                    )}
                    onChange={(checked) => toggleModule(module.id, checked)}
                  />
                ))}
              </div>
              <div className="build-options">
                <label className="field">
                  <span>默认页面</span>
                  <select
                    value={draft.defaultModule}
                    onChange={(event) => {
                      const module = modules.find((item) => item.id === event.target.value);
                      if (module && draft.modules[module.id])
                        editDraft({ ...draft, defaultModule: module.id });
                    }}
                  >
                    <option value="" disabled>
                      请选择默认页面
                    </option>
                    {enabledModules.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.label}
                      </option>
                    ))}
                  </select>
                  <small>进入工作台时优先打开的页面。</small>
                </label>
                <label className="field">
                  <span>构建环境</span>
                  <select
                    value={mode}
                    onChange={(event) => {
                      if (event.target.value === 'staging' || event.target.value === 'production')
                        setMode(event.target.value);
                    }}
                  >
                    <option value="production">生产环境</option>
                    <option value="staging">预发布环境</option>
                  </select>
                  <small>不同环境的产物分别生成。</small>
                </label>
              </div>
              {(touched || !isNew) && errors.length > 0 && (
                <ul className="validation-errors" role="alert">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
              <div className="configuration-note">
                <span aria-hidden="true">i</span>
                <p>配置在本次构建中固定，修改后重新构建生效。用户角色权限继续由业务系统管理。</p>
              </div>
              <div className="form-actions">
                <p>
                  {active
                    ? '构建进行中，完成后可继续编辑。'
                    : isNew
                      ? '新企业配置将保存到本地项目。'
                      : `${enabledModules.length} 个模块 · ${defaultLabel ?? '待选择默认页面'} · ${modeLabels[mode]}`}
                </p>
                <div>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={errors.length > 0}
                    onClick={() => {
                      void submit(false);
                    }}
                  >
                    {pending === 'save' ? '正在保存…' : '保存配置'}
                  </button>
                  <button type="submit" className="button primary" disabled={errors.length > 0}>
                    {pending === 'build' ? '正在提交…' : active ? '正在构建…' : '保存并构建'}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </section>
          </fieldset>
        </form>
        <aside className="result-column">
          <BuildPanel job={job} modules={modules} pollError={pollError} />
          <div className="delivery-note">
            <strong>从一份代码，到不同企业版本</strong>
            <p>模块选择会保存为企业配置。构建完成后，交付包包含该企业的固定模块组合。</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
