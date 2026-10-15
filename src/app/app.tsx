import { Component, lazy, Suspense, useState } from 'react';
import type { ComponentType, ErrorInfo, LazyExoticComponent, ReactNode } from 'react';
import { Link, Navigate, NavLink, useLocation } from 'react-router-dom';
import type { ModuleId } from '../../shared/build-profile.ts';
import { buildProfile } from '../platform/features.ts';
import { DEMO_ACCESS } from '../platform/permissions.ts';
import { activeRegistry, pageLoaders } from './active-modules.ts';
import { getNavigation } from './navigation.ts';
import { resolveAppRoute } from './router.ts';
import { AccessContext, PageParamsContext } from './page-context.tsx';

// Lazy imports are generated per build; disabled modules have no loader here.
const pages: Partial<Record<ModuleId, LazyExoticComponent<ComponentType>>> = {};
for (const module of activeRegistry) {
  const loader = pageLoaders[module.id];
  if (loader) pages[module.id] = lazy(loader);
}
const roles = [
  { id: 'member', label: '完整权限用户' },
  { id: 'admin', label: '管理员' },
  { id: 'chatOnly', label: '仅对话权限' },
  { id: 'noAccess', label: '无页面权限' },
  { id: 'anonymous', label: '未登录' },
] as const;
type DemoRole = (typeof roles)[number]['id'];

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('页面加载失败', error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <div className="empty-state" role="alert">
        <h1>页面加载失败</h1>
        <p>请刷新页面以获取最新版本。</p>
        <button className="button" onClick={() => window.location.reload()}>
          刷新页面
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function App() {
  const [role, setRole] = useState<DemoRole>('member');
  const access = DEMO_ACCESS[role];
  const location = useLocation();
  const navigation = getNavigation(buildProfile, access, activeRegistry);
  const route = resolveAppRoute(location.pathname, buildProfile, access, activeRegistry);
  const activeLabel =
    route.kind === 'page'
      ? (activeRegistry.find((module) => module.id === route.moduleId)?.display.title ??
        '企业工作台')
      : '企业工作台';
  let content: ReactNode;
  if (route.kind === 'redirect') content = <Navigate to={route.to} replace />;
  else if (route.kind === 'page') {
    const Page = pages[route.moduleId];
    content = Page ? (
      <PageParamsContext.Provider value={route.params}>
        <PageBoundary key={location.pathname}>
          <Suspense
            fallback={
              <div className="empty-state" role="status">
                正在加载页面…
              </div>
            }
          >
            <Page />
          </Suspense>
        </PageBoundary>
      </PageParamsContext.Provider>
    ) : (
      <div className="empty-state" data-testid="route-not-found">
        <h1>页面不存在</h1>
      </div>
    );
  } else {
    const messages = {
      'not-found': ['页面不存在', '此链接对应的功能不可用，或页面地址有误。'],
      unauthenticated: ['请先登录', '登录后可查看你有权限使用的功能。'],
      forbidden: ['暂无访问权限', '请联系管理员确认你的页面权限。'],
      'no-access': ['暂无可用功能', '当前账号没有可访问的功能，请联系管理员。'],
    } as const;
    const [title, description] = messages[route.kind];
    content = (
      <div className="empty-state" data-testid={`route-${route.kind}`}>
        <p className="eyebrow">ENTERPRISE WORKSPACE</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {route.kind === 'unauthenticated' ? (
          <button className="button" onClick={() => setRole('member')}>
            演示登录
          </button>
        ) : (
          <Link className="button" to="/">
            返回工作台
          </Link>
        )}
      </div>
    );
  }

  return (
    <AccessContext.Provider value={access}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link to="/" className="brand">
            <span className="brand-symbol" aria-hidden="true">
              e
            </span>
            <span>
              Enterprise<span className="brand-caption">AI WORKSPACE</span>
            </span>
          </Link>
          <div className="workspace-name">
            <span className="workspace-avatar" aria-hidden="true">
              E
            </span>
            <div>
              企业工作空间<small>{buildProfile.id}</small>
            </div>
          </div>
          <nav aria-label="主导航">
            {navigation.map((group) => (
              <div className="nav-group" key={group.id}>
                <p>{group.label}</p>
                {group.items.map((item) => (
                  <NavLink
                    key={item.moduleId}
                    to={item.href}
                    className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="status-dot" /> 企业独立构建<small>版本 {__APP_VERSION__}</small>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumb">
              工作空间 <span>/</span> <strong>{activeLabel}</strong>
            </div>
            <label className="role-control">
              演示权限{' '}
              <select
                value={role}
                onChange={(event) => {
                  const selected = roles.find((item) => item.id === event.target.value);
                  if (selected) setRole(selected.id);
                }}
              >
                {roles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </header>
          <main id="main-content">{content}</main>
          <footer>
            演示工作台 · 尚未连接业务服务{' '}
            <span>
              {import.meta.env.VITE_ENV_LABEL} · {__BUILD_MODE__}
            </span>
          </footer>
        </div>
      </div>
    </AccessContext.Provider>
  );
}
