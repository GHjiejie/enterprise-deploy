# enterprise-deploy

一套代码，通过版本化企业配置独立构建、独立交付。基于 Vite、React、TypeScript，企业模块在构建时装配并进行物理裁剪，用户页面权限在运行时独立判断。

关闭模块的私有实现、文案、样式及专属资源不得进入该企业交付包。构建使用仅包含已启用模块的虚拟入口，并检查浏览器构建依赖图、输出归属和最终文件。模型、会话、图片、视频页面仍为本地演示，没有连接真实业务后端；真实身份和服务端逐请求授权属于后续接入工作。

## 可视化配置与打包

无需手写企业模块开关。在项目根目录执行：

```bash
npm ci
npm run configure
```

打开 http://127.0.0.1:5180 ，选择或新建企业，勾选开放模块、设置默认页面和构建环境，再点击「保存并构建」。页面展示配置校验、编译与裁剪、快照和压缩包复验的实际阶段与日志；成功后可以预览固定版本、下载 `.tar.gz` 交付包和裁剪报告。

配置保存到企业 JSON，构建使用隔离快照。构建控制台是独立的本地工具，不加入客户静态包；它不配置用户角色，也不会自动放宽部署目标允许的模块上限。详见 [可视化控制台说明](docs/build-console.md)。

## 本地运行

需要 Node.js 22.12+（22 LTS）或 24+，使用 npm 和仓库中的 `package-lock.json`。

```bash
npm ci
APP_PROFILE=qianshi npm run dev
```

打开 http://127.0.0.1:5173 。必须显式设置 `APP_PROFILE`，没有默认全功能降级。修改企业配置后重启开发服务器。

| 企业配置       | 模型广场 | 智能对话 | 图片生成体验 | 视频生成体验 |
| -------------- | -------- | -------- | ------------ | ------------ |
| `standard`     | 开启     | 开启     | 开启         | 开启         |
| `enterprise-a` | 开启     | 开启     | 关闭         | 关闭         |
| `enterprise-b` | 开启     | 开启     | 开启         | 开启         |
| `qianshi`      | 关闭     | 关闭     | 关闭         | 开启         |

页面的「演示权限」选择器用于验证管理员、普通成员、仅对话权限、无页面权限和未登录情形。当前演示产物即使使用 `production` 模式也仍包含演示身份；它不能作为生产认证或真实 API 授权。生产业务接入必须替换该适配器和演示入口。管理员也无法从活动注册表访问未交付的模块。

## 构建与验证

```bash
npm run check
npm run test:pruning
npm run test:console
APP_PROFILE=qianshi npm run build -- --mode staging
APP_PROFILE=qianshi npm run build -- --mode production

# 对实际输出独立复验 V2 记录、裁剪报告及文件
npm run pruning:verify -- --artifact dist/qianshi/production

# 浏览器冒烟针对已经构建的静态产物运行
npx playwright install chromium
APP_PROFILE=qianshi APP_MODE=production npm run test:delivery

# 本地顺序验收全部已保存企业 × staging / production
npm run test:matrix

# 通过 HTTP 预览，不能双击 index.html 使用 file:// 打开
APP_PROFILE=qianshi npm run preview -- --mode production
```

预览地址默认为 http://127.0.0.1:4173 。环境仅支持 `development`、`staging`、`production`。输出位于 `dist/<企业>/<环境>/`，可交付版本必须同时含 `pruning-report.json` 和 `schemaVersion: 2` 的 `release-record.json`。

`npm run build -- --mode ...` 是完整构建入口：取得企业/环境输出锁、使旧记录失效、完成类型和配置检查、编译与裁剪、生成报告及 V2 记录，再复验实际文件。协调器失败会清除成功记录并释放自己的锁。直接执行 `vite build` 也受构建图和输出门禁约束，但不生成可交付的 V2 成功记录；请使用 npm 构建入口。发布构建拒绝 `.env.local` 和对应 `.env.<mode>.local`，不要向浏览器环境变量写入秘密。

`npm run check` 包含格式、严格类型、全部企业配置与基础单元测试。`test:pruning` 是独立必需验收，验证四模块的 15 个非空组合 × 两种发布环境，以及禁用依赖、私有资源、未知输出、原始 Vite、篡改和输出锁等负向情形。GitHub Actions 将组合验证放在独立作业，企业交付矩阵只运行各自真实构建、浏览器、裁剪和目标发布校验。

## 代码边界

```text
config/profiles/                完整、显式的企业模块配置
config/backend-compatibility.json   前端声明的后端兼容条件
config/backend-policies/        发布兼容校验用的演示目标声明
config/delivery-policies/       独立可信目标的模块上限与允许裁剪规则
shared/module-assembly.ts       无导入副作用的装配算法
build/module-catalog.ts         Node/控制台使用的完整模块目录
build/active-modules-plugin.ts  按企业生成 virtual:enterprise-modules
build/enterprise-config.ts      统一企业构建上下文与 Vite 配置
build/build-enterprise.ts       完整构建协调器
build/output-lock.ts            企业/环境输出锁与记录失效
build/pruning-plugin.ts         浏览器图、私有依赖与输出来源检查
build/pruning.ts                裁剪报告协议与统一最终文件验证器
build/release-record.ts         V1 历史读取、V2 记录、交付目标校验
build/release-cli.ts            本地归档、公开 generation、发布与回滚
build/console-*.ts              配置、任务、严格打包与固定预览
build-console/                 独立可视化配置界面
src/app/                       消费活动注册表的路由、页面与导航
src/platform/                  权限、跳转与显式生命周期
src/modules/                   各模块私有业务、数据、文案和样式
src/shared/                    通用表单、上传、任务展示等公共能力
tests/pruning/                 30 组合与裁剪负向验证
tests/profiles/                配置、装配、路由与生命周期测试
tests/console/                 控制台、包安全、固定预览与下载测试
tests/delivery/                发布策略、完整性、迁移及浏览器冒烟
deploy/nginx.conf              current/site 与 current/assets 示例
```

客户应用只获得已启用模块的元数据、页面加载器与启动器；完整目录只供 Node 构建工具和控制台使用。公共层不能反向导入模块私有实现，模块不能跨越其他模块的私有目录。无法证明来源的输出、外部代码加载、source map 和未支持的资源形态会使构建失败，不能用一个空归属数组绕过检查。

模块定义只声明路由、导航、入口、权限标识和依赖。`activateModules` 提供显式启动与反向清理扩展点；真实初始化必须放在该入口或权限已通过的页面生命周期内。路由、导航、快捷入口、旧别名、通用 playground 和详情深链均使用同一份活动注册表。

公共上传与图片生成业务独立：视频或对话需要的图片/文件上传可以保留，不以 `image` 字符串是否出现判断泄漏。模型卡片保留某种 API 能力描述也不代表授予页面或 API 权限；完整模型业务数据只属于模型广场模块。

## 增加企业或模块

增加企业：使用控制台，或新增完整 `config/profiles/<id>.json`。校验与 CI 自动发现企业配置，不存在隐式继承。参加目标发布验收时，另外提供对应企业/环境的可信后端兼容声明和交付策略；不要从待发布包自动生成或放宽目标上限。

增加模块：更新模块 ID、所有受支持企业的完整配置、Node 目录、模块元数据与私有入口，同时更新归属规则、目标策略和测试。未开放的企业明确填写 `false`；缺字段、无效依赖、默认入口关闭或未知字段均会失败。新增模块必须验证路由、资源、共享层引用、预加载与生命周期的完整依赖范围。

## 归档、部署和回滚

当前提供**本地文件系统部署适配器**，实际服务器、SSH、Kubernetes、CDN 或域名需要接入已有交付体系。完整命令和首次迁移步骤见 [交付操作说明](docs/delivery.md)。

```bash
npm run release:verify -- \
  --profile qianshi --mode production \
  --artifact dist/qianshi/production \
  --backend-policy config/backend-policies/demo-qianshi-production.json \
  --delivery-policy config/delivery-policies/demo-qianshi-production.json

npm run release:deploy -- \
  --profile qianshi --mode production \
  --artifact dist/qianshi/production \
  --target deployments/qianshi-production \
  --backend-policy config/backend-policies/demo-qianshi-production.json \
  --delivery-policy config/delivery-policies/demo-qianshi-production.json
```

发布和回滚只接受通过当前目标策略的 V2：企业/环境一致、开启模块不超过当前上限、裁剪规则版本与摘要被允许、后端兼容且实际文件一致。旧 V1 必须重新构建，不能通过补空报告或修改版本号升级。

部署先保存私有归档，再准备 `public-generations/<id>/site` 和只含当前策略合规版本的 `assets`，最后原子切换同一个 `current` 指针。模块收缩后不合规旧资源不进入新公开集合，旧 URL 返回 404，旧标签页可能需要刷新。**首次升级必须同步应用新的 Nginx 根路径**；继续使用旧根 `/assets/` 配置仍会暴露旧资源。历史归档、旧根资源与证据不会自动删除。

## 交付与安全边界

- 当前整改覆盖构建装配、私有实现与资源裁剪、V2 证据、控制台快照/包复验及本地发布策略；技术方案 P1–P5 已通过本地验收，产物身份、矩阵及迁移限制见[整改验证记录](docs/pruning-verification-2026-10-15.md)。
- 前端裁剪降低禁用实现随包交付的风险，不能阻止客户编写新代码，也不能召回已下载或已缓存的旧副本。
- 企业模块开关不决定模型 API 商业权益、历史数据或运行中任务。真实服务端必须逐请求验证身份、企业权益、用户权限及资源归属。
- 演示身份与 `demo-*.json` 兼容/交付策略仅用于本地流程，不代表生产授权或可信制品来源。SHA-256 检查字节一致性，真实来源依赖受控 CI、制品库、部署权限及所需签名机制。
- 不提供运行时模块热切换或远程配置平台。Nginx 缺失静态资源返回真实 404；SPA 内部页面不存在仍可能由 HTTP 200 的 HTML 展示。

原始依据见 [架构原文](docs/architecture.md)。[2026 年 10 月 15 日本地风险评估](docs/local-risk-assessment-2026-10-15.md) 保留整改前产物及受控恢复界面的证据，不改写原始审计结论。[企业模块物理裁剪与交付校验技术方案（V2）](docs/enterprise-build-pruning-design.md) 记录本轮设计与完成标准，P6 真实业务后端待接入。
