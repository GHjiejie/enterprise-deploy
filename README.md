# enterprise-deploy

一套代码，通过版本化企业配置独立构建、独立交付。基于 Vite、React、TypeScript，企业差异固定在构建时，用户权限独立在运行时判断。

仓库原先只有 README，本实现建立了架构方案中的最小业务演示和完整交付基础。模型、对话、图片、视频页面均为明确标记的本地演示；没有虚构或调用后端接口。真实身份、权限、模型、生成任务与企业服务端授权需要接入现有业务服务。

## 可视化配置与打包

无需手写企业模块开关。在项目根目录执行：

```bash
npm ci
npm run configure
```

打开 http://127.0.0.1:5180 ，选择或新建企业，勾选开放模块、设置默认页面和构建环境，再点击「保存并构建」。页面会显示真实日志，成功后可预览该次构建并下载 `.tar.gz` 交付包。

配置会保存到企业 JSON，构建使用隔离配置快照；已构建的版本保持固定。构建控制台是独立的本地工具，不加入客户静态包。用户角色权限仍由业务系统处理。详见 [可视化控制台说明](docs/build-console.md)。

## 本地运行

需要 Node.js 22.12+（22 LTS）或 24+，使用 npm 和仓库中的 `package-lock.json`。

```bash
npm ci
APP_PROFILE=enterprise-a npm run dev
```

打开 http://127.0.0.1:5173 。必须显式设置 `APP_PROFILE`，没有默认全功能降级。修改企业配置后重启开发服务器。

| 企业配置       | 模型广场 | 智能对话 | 图片生成体验 | 视频生成体验 |
| -------------- | -------- | -------- | ------------ | ------------ |
| `standard`     | 开启     | 开启     | 开启         | 开启         |
| `enterprise-a` | 开启     | 开启     | 关闭         | 关闭         |
| `enterprise-b` | 开启     | 开启     | 开启         | 开启         |

页面的「演示权限」选择器用于验证完整权限、管理员、仅对话权限、无页面权限和未登录情形。它不是生产认证功能。管理员也不能打开构建时关闭的模块。

## 构建与验证

```bash
npm run check
npm run test:console
APP_PROFILE=enterprise-a npm run build -- --mode staging
APP_PROFILE=enterprise-a npm run build -- --mode production
APP_PROFILE=enterprise-b npm run build -- --mode production

# 浏览器冒烟测试针对已经构建的静态产物运行
npx playwright install chromium
APP_PROFILE=enterprise-a APP_MODE=production npm run test:delivery

# 在本地顺序验收全部企业的 staging / production 产物
npm run test:matrix

# 查看一个已构建企业版本
APP_PROFILE=enterprise-a npm run preview -- --mode production
```

支持的环境仅有 `development`、`staging`、`production`。产物分别输出到 `dist/<企业>/<环境>/`，每份产物含 `release-record.json`。发布构建拒绝 `.env.local` 和对应 `.env.<mode>.local`，CI 使用隔离作业。不要向任何浏览器环境变量写入秘密。

`npm run check` 包含格式与严格类型检查、全部企业配置和模块组合校验、配置/装配/控制台/发布单元测试。GitHub Actions 自动发现已保存的企业配置，对 staging/production 执行构建、浏览器冒烟和发布校验，然后归档对应产物；控制台有独立浏览器工作流验收。

## 代码边界

```text
config/profiles/                完整、显式的企业模块配置
config/backend-compatibility.json   前端声明的后端兼容条件
config/backend-policies/        发布验证用的演示目标策略
shared/build-profile.ts         模块标识、企业类型、环境类型
shared/module-definition.ts     无副作用的模块元数据契约
build/load-profile.ts           严格读取、字段/类型/版本校验
build/validate-profiles.ts      全部配置和装配组合校验
build/release-record.ts         公开元数据、源码与制品摘要、目标校验
build/release-cli.ts            本地归档、原子发布、回滚命令
build/console-*.ts              本地配置、构建任务、下载与独立产物预览
build-console/                 独立的可视化企业配置界面
src/app/module-registry.ts      所有模块元数据的共同注册表
src/app/router.ts               页面加载前的路由与权限判断
src/app/navigation.ts           同一模块集合生成导航
src/platform/                  统一开关、权限、跳转、显式生命周期
src/modules/                   各模块元数据与演示页面
src/shared/                    独立的公共上传、模型元数据与入口组件
tests/profiles/                 配置、装配、路由、权限与生命周期测试
tests/delivery/                 制品完整性、交付目标与浏览器冒烟测试
deploy/nginx.conf              静态站点的缓存和路由示例
```

模块定义只声明路由、导航、入口、权限标识和必要依赖，不在导入时请求数据或启动轮询。`activateModules` 提供显式启动与反向清理扩展点；当前演示模块没有启动副作用。真实模块需要把初始化放在该入口或权限已通过的页面生命周期内。

路由解析先筛选已启用模块，再检查当前用户权限，最后才渲染懒加载页面。图片、视频的规范路径、任务详情、旧路径别名和通用 playground 分支都使用相同规则。关闭的路径显示页面不存在；启用但无权限的页面进入登录或无权限状态。

模型卡片按照明确的 `capability` 元数据展示。关闭图片/视频体验只隐藏对应在线入口；保留模型卡片不代表授予 API 权限。快捷入口、模型体验按钮、体验搜索和历史跳转均通过统一跳转服务。智能对话的图片/文件上传独立于图片生成模块。

## 增加企业或模块

增加企业：运行 `npm run configure`，在页面中新建企业并明确选择模块与默认入口，保存或一键构建。也可以手动新增完整 `config/profiles/<id>.json`。校验与 CI 自动发现企业配置；参加正式发布验收时，为该企业增加实际目标后端策略。不存在配置继承或隐式覆盖。

增加模块：更新 `MODULE_IDS`、每份受支持企业配置、模块元数据和页面映射；未确认企业显式填写 `false`。配置缺失模块字段会失败。入口与依赖不满足、未知字段、字符串布尔值、无效模式及配置 ID 不一致均会失败。新增模块时同时检查页面内快捷入口、搜索、通知/历史跳转、预加载与公共资源依赖。

## 归档、部署和回滚

当前提供可验证的**本地文件系统部署适配器**，没有假定真实服务器、SSH、Kubernetes 或企业域名。请参阅 [交付操作说明](docs/delivery.md) 的完整命令与目标目录约束。

```bash
APP_PROFILE=enterprise-a npm run build -- --mode production
npm run release:verify -- \
  --profile enterprise-a --mode production \
  --artifact dist/enterprise-a/production \
  --backend-policy config/backend-policies/demo-enterprise-a-production.json

npm run release:deploy -- \
  --profile enterprise-a --mode production \
  --artifact dist/enterprise-a/production \
  --target deployments/enterprise-a-production \
  --backend-policy config/backend-policies/demo-enterprise-a-production.json
```

部署会先校验企业、环境、后端兼容条件和实际文件摘要，归档后原子切换 `current`。旧资源保留以支持已打开页面与回滚。演示后端策略仅用于运行交付闭环，不能代表真实后端已经实施能力限制。生产需从可信部署流程获得目标策略并保留受控制品。

发布记录包含构建配置及其摘要、启用模块、应用版本、Git 提交、工作区源码状态与摘要、工具链版本、锁文件摘要、构建命令、构建 ID、后端兼容条件和实际产物清单/摘要。源码未提交时会标记为 dirty，不能仅凭 Git 提交重现该构建。摘要用于完整性核对；来源可信性仍依赖 CI、制品库与访问控制。

## 交付边界

- 已实现构建时企业装配、统一入口控制、运行时页面权限适配、制品追溯、发布目标校验、归档和本地原子回滚。
- 提供打包前的本地可视化模块配置、真实构建日志、固定版本预览与下载；不提供远程配置管理平台。
- 不提供运行时企业功能热切换，不承诺禁用代码物理裁剪。禁用模块的代码块可能仍在静态包中。
- 不改变模型 API 商业权益、历史数据或进行中的任务。前端开关不能替代服务端逐请求授权。
- 真实后端与生产部署平台尚未接入。Nginx 示例中的 SPA 页面不存在仍可能是 HTTP 200，需要真实 HTTP 404 时单独由服务层实现。
- 已打开的旧页面需要服务端限制与刷新策略配合；本地部署保留旧资源且 HTML 重新验证，避免新旧资源混用。

实现依据为用户提供的 [架构原文](docs/architecture.md)。构建常量和环境机制遵循 [Vite define](https://vite.dev/config/shared-options#define) 与 [Env Variables and Modes](https://vite.dev/guide/env-and-mode)。

## 本地风险记录

[2026 年 10 月 15 日本地风险评估](docs/local-risk-assessment-2026-10-15.md) 记录了 `qianshi` 产物中禁用模块代码仍被交付、修改前端副本可恢复隐藏界面，以及共享代码和物理裁剪验收的缺口。报告包含产物身份、文件证据、受控浏览器对照、整改建议和验收要求；恢复界面不代表已验证真实 API 越权。
