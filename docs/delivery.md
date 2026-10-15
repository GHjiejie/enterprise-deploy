# 企业制品发布与回滚

本仓库提供可在本地完整演练的静态制品发布闭环。构建产物按企业和环境隔离，归档、部署、回滚都重新核对同一份发布记录。命令只操作显式指定的本地目录；实际服务器、域名、证书、CI 凭据及后端授权应接入已有交付体系。

打包前可以执行 `npm run configure`，在本地页面选择企业模块并构建、预览和下载；详见 [可视化控制台说明](build-console.md)。此工具生成的发布记录与下面的命令行交付流程一致。

## 构建与验收

使用 Node.js 22.12 或满足 package.json engines 的更新版本，执行：

```bash
npm ci
npm run check
APP_PROFILE=enterprise-a npm run build -- --mode production
APP_PROFILE=enterprise-a APP_MODE=production npm run test:delivery
npm run release:verify -- --profile enterprise-a --mode production --artifact dist/enterprise-a/production --backend-policy config/backend-policies/demo-enterprise-a-production.json
```

首次运行浏览器验收前执行 `npx playwright install chromium`；Linux CI 使用 `npx playwright install --with-deps chromium`。CI 动态发现所有有效企业配置，分别对 staging、production 构建、浏览器验收、核验摘要并上传独立制品。CI 使用独立检出和 `npm ci`，缓存依赖而不复用其他企业的输出。新增企业的真实后端兼容声明需同步准备。

如果本地 4173 已有预览运行，可用 `DELIVERY_PORT=4197 npm run test:matrix` 指定独立测试端口。

## 发布记录

Vite 完成构建后在产物根目录生成 `release-record.json`，包含以下明确列出的公开元数据：

| 字段                                     | 含义                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| profileId / environment                  | 交付企业及环境，必须与部署目标严格相同                                   |
| appVersion / gitCommit                   | 应用版本和检出提交；没有提交时为 unversioned                             |
| sourceState                              | 工作目录是否存在修改，以及公开构建输入快照的 SHA-256 摘要                |
| profile / profileDigest                  | 当时经过严格校验的公开企业配置及其摘要，供历史回滚使用                   |
| enabledModules                           | 与当时企业配置严格一致的模块清单                                         |
| buildId / builtAt                        | 此次独立构建 ID 及 UTC 构建时间                                          |
| toolchain / lockfile                     | Node、npm、Vite、TypeScript 版本及 package-lock.json 摘要                |
| buildCommand                             | 本次构建对应的企业及环境命令                                             |
| backendCompatibility                     | 声明的策略版本、接口契约版本、所需能力列表                               |
| directories / artifacts / artifactDigest | 完整、排序后的目录与文件清单，每个文件的字节数及 SHA-256，整份清单的摘要 |

文件清单排除 `release-record.json` 自身，避免递归摘要；验证器同时严格检查记录结构、公开配置摘要、模块清单和整份文件清单。任何文件修改、缺失、额外文件、额外空目录、符号链接或特殊文件都使核验失败。记录不读取或序列化整个进程环境，也不读取 `.env.local`、`.env.*.local` 或服务端密钥。

公开构建输入快照覆盖 `build/`、`config/`、`shared/`、`src/`、`index.html`、`package.json`、`package-lock.json`、根目录 `tsconfig*.json` / `vite.config.*` 和三个明确命名的 `.env.development` / `.env.staging` / `.env.production`。它对排序后的文件相对路径和逐文件摘要再计算 SHA-256，包含未跟踪文件。开发中的本地构建可能对应一个旧 HEAD，因此同时记录 `sourceState.dirty = true` 和源文件摘要；无法读取 Git 状态时也记为 true。受控 CI 应从已提交、干净的检出构建。

摘要提供制品一致性核对；有权同时替换文件和清单的人也可以重新计算摘要。真实供应链来源仍需依靠受控 CI、受限的制品库及部署权限，必要时增加制品签名。发布记录和浏览器配置均为公开信息。

## 后端兼容声明

`config/backend-compatibility.json` 是该前端版本声明的兼容条件：

```json
{
  "policyVersion": "demo-v1",
  "contractVersion": "demo-contract-v1",
  "requiredCapabilities": []
}
```

目标后端声明通过 `--backend-policy` 指定，必须明确匹配目标企业及环境，并满足前端声明的策略版本、接口契约版本和所有所需能力。`config/backend-policies/` 中的 demo 文件只是此演示应用的兼容性样例，尚未对任何真实服务端进行探测。接入业务 API 时，应由后端或交付系统提供可信且当前的声明；例如 `requiredCapabilities: ["chat.create"]` 需要目标 `capabilities` 包含 `chat.create`。

兼容检查不根据 `imageStudio` / `videoStudio` 前端开关推导 API 商业权限。关闭在线体验、继续开放对应 API 是合法组合。服务端对每次操作独立验证登录身份、企业范围和操作权限。

## 归档与本地部署

以下命令使用一个专用目录。它可以不存在或为空；第一次归档/部署会写入绑定企业与环境的 `.enterprise-target.json`。已有非空且无标记的目录、标记不匹配、符号链接管理目录、仓库目录、home 或其上层目录都会被拒绝。

```bash
npm run release:archive -- --profile enterprise-a --mode production --artifact dist/enterprise-a/production --target deployments/enterprise-a-production --backend-policy config/backend-policies/demo-enterprise-a-production.json
npm run release:deploy -- --profile enterprise-a --mode production --artifact dist/enterprise-a/production --target deployments/enterprise-a-production --backend-policy config/backend-policies/demo-enterprise-a-production.json
```

`release:deploy` 自身也会先验证并归档，无需依赖操作者单独运行归档。相同构建 ID 只允许完全相同的发布记录和文件；不同内容不能覆盖已有发布。复制后的目录也再次核验，以检测复制期间源目录被改变。

目标目录结构如下：

```text
deployments/enterprise-a-production/
├── .enterprise-target.json
├── archives/<buildId>/          # 已核验的完整历史制品
├── releases/<buildId>/          # 本地可服务的完整版本
├── assets/                     # 跨版本保留的带指纹静态资源
└── current -> releases/<buildId>
```

发布先复制独立版本、保留资源，最后通过同一文件系统内的 symlink rename 原子切换 `current`。操作使用目标目录锁防止两个发布过程交叉执行。进程异常退出可能留下 `.release-lock`，应先确认没有发布任务运行，再人工移除锁。代码只清理自己生成的临时目录，不自动删除历史版本或历史资源。

## 回滚

从历史发布记录中取得希望恢复的 `buildId`，使用同企业、同环境的归档：

```bash
npm run release:rollback -- --profile enterprise-a --mode production --release BUILD_ID --target deployments/enterprise-a-production --backend-policy config/backend-policies/demo-enterprise-a-production.json
```

请把 `BUILD_ID` 换成目标 `archives/` 下实际存在的目录名。回滚核对归档内的公开企业配置及摘要，不重新加载当前源码中的企业配置。它再次校验归档文件完整性和**当前目标后端**的兼容声明，再原子切换 `current`。归档被篡改、目标错误或后端不兼容时拒绝回滚，保持当前版本。

前端回滚不会修改后端数据或安全策略，也不会强制关闭已经打开的旧页面。需要立即限制能力时，应由服务端先执行授权限制。

## Nginx 与浏览器缓存

`deploy/nginx.conf` 是 enterprise-a / production 的示例。将其中的 `/srv/enterprise/enterprise-a-production` 改为实际发布目标目录，并由已有运维流程部署该配置：

- 应用 HTML 与发布记录使用 `Cache-Control: no-cache, must-revalidate`，刷新时重新验证版本。
- `/assets/` 从目标根目录下的跨版本资源库提供，带指纹文件使用一年 immutable 缓存；缺失资源返回 404，不能回退成 HTML。
- 应用路由回退到当前版本 `index.html`，允许 React 路由执行统一页面不存在/无权限处理。

仅保留 `releases/<buildId>` 并让所有请求都走 `current`，仍会让旧页面请求不到已经切换的旧 JS。本实现因此保留单独的 `assets/` 资源库，并让 Nginx 明确从该库提供资源。发布器要求这里的资源使用带至少八位指纹的文件名；已有同名不同内容会拒绝发布。历史资源不自动回收，实际保留期和清理应在确认旧页面支持窗口后制定。

## 验收边界

交付测试覆盖企业 A 的禁用入口与直接/嵌套路由、企业 B 的正常入口与用户权限、公共上传保留、默认入口恢复，以及目标核对、篡改拒绝、归档、升级和回滚。当前基础交付保证正常应用路径中关闭体验模块。构建可能仍包含关闭模块的 JS/CSS；代码物理裁剪需要另行定义资源范围、实现生成入口并验收。
