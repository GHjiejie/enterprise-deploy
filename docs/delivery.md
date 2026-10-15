# 企业制品发布与回滚

本仓库提供可在本地演练的企业静态制品交付流程。可发布版本必须通过物理裁剪检查，包含 `pruning-report.json` 与 V2 发布记录；归档、部署、回滚重新检查实际文件和当前可信目标策略。命令只操作显式指定的本地目录，真实服务器、域名、CDN、凭据和服务端授权需要接入已有交付体系。

打包前也可以执行 `npm run configure`，在本地页面选择模块、构建、预览和下载。控制台使用同一构建协调器，并对固定快照和压缩包进行复验，详见 [可视化控制台说明](build-console.md)。

## 构建与验收

使用满足 `package.json` engines 的 Node.js 版本：

```bash
npm ci
npm run check
APP_PROFILE=qianshi npm run build -- --mode production
npm run pruning:verify -- --artifact dist/qianshi/production
APP_PROFILE=qianshi APP_MODE=production npm run test:delivery
npm run release:verify -- \
  --profile qianshi --mode production \
  --artifact dist/qianshi/production \
  --backend-policy config/backend-policies/demo-qianshi-production.json \
  --delivery-policy config/delivery-policies/demo-qianshi-production.json
```

首次运行浏览器验收前执行 `npx playwright install chromium`；Linux CI 使用 `npx playwright install --with-deps chromium`。`npm run test:pruning` 独立运行 15 个非空模块组合 × staging/production 和负向测试，基础 `npm run check` 不重复执行这一组。CI 将基础检查、组合测试和企业交付矩阵分开，所有已保存企业均自动发现；上传的企业产物必须通过浏览器、裁剪和目标发布核验。

`npm run build -- --mode ...` 调用 `build/build-enterprise.ts`，先固定配置和构建 ID，取得同企业/环境输出锁，使旧记录失效，再完成类型和配置检查、编译、收集证据、生成报告和 V2 记录并复验。协调器失败不会留下本次有效成功记录。直接运行 `vite build` 也受图和输出检查约束，但不完成协调器流程，不产生可发布的 V2 记录。

输出锁位于 `dist/.locks/<企业>-<环境>.lock`。不同企业或环境可以分别构建，同一输出不能并发覆盖。正常退出释放本进程取得的锁；异常中断可能留锁，必须先确认对应 PID/构建 ID 没有仍在执行，再人工处理，不能为取得构建结果自动删除未知锁。

本地使用 HTTP 预览：

```bash
APP_PROFILE=qianshi npm run preview -- --mode production
```

打开 http://127.0.0.1:4173 ，不要用 `file://` 双击 `index.html`。如果测试端口已占用，可以使用 `DELIVERY_PORT=4197 npm run test:matrix` 在独立端口顺序验收全部企业。

## 裁剪证据与发布记录 V2

新构建先生成 `pruning-report.json`：记录构建身份、配置摘要、开启/排除/实际输出模块、检查器与所有权规则版本和摘要、图与资源检查结果，以及每份业务输出的路径、大小、SHA-256、资源类别和非空归属。客户报告不包含本机绝对源码路径或其他企业配置。

报告清单排除报告自身和发布记录。随后生成 `schemaVersion: 2` 的 `release-record.json`：

| 字段                                     | 含义                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| profileId / environment                  | 必须与发布目标严格一致的企业和环境                         |
| profile / profileDigest / enabledModules | 当次完整企业配置、摘要与开启模块                           |
| buildId / builtAt                        | 独立构建 ID 与 UTC 时间                                    |
| appVersion / gitCommit / sourceState     | 应用版本、完整提交 ID、工作区 dirty 状态和公开构建输入摘要 |
| toolchain / lockfile / buildCommand      | Node、npm、Vite、TypeScript、锁文件摘要和构建命令          |
| backendCompatibility                     | 后端策略版本、接口契约版本和所需能力                       |
| pruning                                  | 报告路径与 SHA-256、检查器版本、所有权规则版本与摘要       |
| directories / artifacts / artifactDigest | 实际目录与文件清单、大小、逐文件摘要和完整清单摘要         |

V2 文件清单包含业务输出和裁剪报告，排除发布记录自身，避免递归摘要。记录、报告、实际文件和身份必须一致；额外文件、额外空目录、遗漏、篡改、符号链接或特殊文件都会失败。旧 V1 可以被历史解析器读取，但不具备物理裁剪资格，新的下载、归档、部署和回滚均拒绝它。旧包必须从源码重新构建，不能追加空报告或改版本号伪装升级。

公开源码输入摘要覆盖 `build/`、`config/`、`shared/`、`src/`、`index.html`、依赖清单、根目录 TypeScript/Vite 配置和三个明确的环境文件。包含未跟踪的公开输入，不读取 `.env.local`、`.env.*.local` 或整个进程环境。工作区有修改时标记 dirty；当前 HEAD 本身不能重现未提交源码，正式 CI 应使用干净检出。

SHA-256 证明字节一致性，不能证明构建来源。能同时改包与清单的人也能重算摘要；可信来源需依靠受控 CI、制品库、部署权限及按需增加的签名验证。裁剪成功也不替代服务端授权。

## 当前目标策略

所有发布命令同时要求两个独立输入：

- `--backend-policy FILE`：当前目标后端契约与能力声明，匹配前端的 `config/backend-compatibility.json`。关闭体验页面并继续开放某种 API 可以是合法业务组合，前端开关不能推导 API 商业权益。
- `--delivery-policy FILE`：由可信部署配置提供的当前模块交付上限与允许的裁剪规则。它不能从待发布包、历史 profile 或控制台提交的开关自动放宽。

交付策略结构如下；`ownershipPolicyDigest` 必须换成目标批准的实际摘要：

```json
{
  "schemaVersion": 1,
  "profileId": "qianshi",
  "environment": "production",
  "allowedModules": ["videoStudio"],
  "minReleaseSchemaVersion": 2,
  "allowedPruningRules": [
    {
      "checkerVersion": "1.0.0",
      "ownershipPolicyVersion": 1,
      "ownershipPolicyDigest": "目标批准的64位SHA-256摘要"
    }
  ]
}
```

包中开启的模块必须为 `allowedModules` 的子集，记录和报告中的规则版本/摘要必须被策略明确允许，并被当前验证器支持。未知字段、未知模块、重复项和无效版本会失败。扩大模块范围或升级规则需要明确更新可信目标配置。

`config/backend-policies/demo-*.json` 和 `config/delivery-policies/demo-*.json` 只是本地演示样例，不代表探测了真实后端，也不代表生产部署策略已经授权。控制台允许构建合法组合供本地评估；某个组合能构建不意味着允许向指定目标发布。

## 归档与本地部署

使用专用目标目录，第一次归档/部署写入 `.enterprise-target.json` 绑定企业和环境。已有非空且无标记的目录、目标标记不符、管理目录符号链接、home、仓库本身或其祖先会被拒绝；目标不能位于输入制品内部。

```bash
npm run release:archive -- \
  --profile qianshi --mode production \
  --artifact dist/qianshi/production --target deployments/qianshi-production \
  --backend-policy config/backend-policies/demo-qianshi-production.json \
  --delivery-policy config/delivery-policies/demo-qianshi-production.json

npm run release:deploy -- \
  --profile qianshi --mode production \
  --artifact dist/qianshi/production --target deployments/qianshi-production \
  --backend-policy config/backend-policies/demo-qianshi-production.json \
  --delivery-policy config/delivery-policies/demo-qianshi-production.json
```

`release:deploy` 自行验证并归档，不依赖事先单独归档。相同构建 ID 只能对应完全相同的记录和字节，不能覆盖已有不同版本；复制后再次校验。

```text
deployments/qianshi-production/
├── .enterprise-target.json
├── archives/<buildId>/                  # 私有完整历史制品
├── releases/<buildId>/                  # 私有已核验版本
├── public-generations/<generationId>/
│   ├── site/                           # 本次选定版本的完整站点
│   ├── assets/                         # 当前策略允许的历史 V2 资源集合
│   └── .public-inventory.json           # 私有资源/版本/策略摘要清单
└── current -> public-generations/<generationId>
```

目标锁内先准备新 generation：复制并核验选定站点，逐份复验归档，只收录满足**当前**策略的 V2 资源，再核对资源摘要。旧 V1、过期规则、篡改包和超过模块上限的历史版本均不参与公开集合。同名资源必须同摘要，冲突拒绝发布。最后通过同一文件系统内的 symlink rename 切换 `current`，站点和资源集合使用同一个指针。

`archives/`、`releases/`、旧 `public-generations/` 和旧根 `assets/` 不自动删除，均不能被静态根或别名公开。`.release-lock` 异常残留时，先确认没有发布任务执行再人工清理。失败清理本次临时目录，不自动销毁历史证据。

## 回滚

```bash
npm run release:rollback -- \
  --profile qianshi --mode production \
  --release BUILD_ID --target deployments/qianshi-production \
  --backend-policy config/backend-policies/demo-qianshi-production.json \
  --delivery-policy config/delivery-policies/demo-qianshi-production.json
```

将 `BUILD_ID` 换成 `archives/` 下真实版本。回滚核对归档自己的配置和字节，但交付上限、裁剪规则和后端声明均使用当前可信目标输入。裁剪正确的旧全模块 V2 仍不能回滚到目前仅允许视频的目标；V1 也被拒绝。没有符合策略的旧版本时就没有可回滚版本，不能自动退回旧全量包。

回滚不会改后端数据、策略或关闭已打开的页面。业务能力需要立即禁用时，服务端先执行逐请求授权限制。

## Nginx、缓存与首次迁移

`deploy/nginx.conf` 是 enterprise-a / production 示例。按实际目标修改路径，并通过现有运维流程部署配置：

- 站点根为 `<目标>/current/site`；`/assets/` 根为 `<目标>/current`，实际提供 `current/assets`，缺失资源返回真实 404。
- HTML、发布记录和裁剪报告使用 `no-cache, must-revalidate`；带指纹静态资源使用一年 immutable 缓存。
- SPA 深链回退到当前 `index.html`；私有归档、版本目录及隐藏文件 URL 明确返回 404。

**必须同时迁移 Nginx 资源根路径。** 继续使用旧 `<目标>/assets` 配置会继续提供未裁剪的历史资源；仅生成新包或切换 current 不足以完成旧 URL 治理。

首次迁移按实际环境执行：

1. 盘点旧 `dist`、控制台快照、下载入口、发布目录、CDN 与 V1 制品，保留受控审计备份。本地整改期间保留的旧证据位于 `dist/.legacy-artifacts/`，不能把它配置成静态资源根。
2. 使用新协调器重新构建目标企业两个环境，完成裁剪、浏览器和目标策略验收；`qianshi` 的当前交付上限为仅视频。
3. 准备合规 generation 与新的 Nginx 配置，验证 HTML、资源、深链、私有路径和旧资源 URL 的状态；切换窗口按部署平台安排，避免旧 current 布局与新配置短暂不兼容。
4. 撤下旧公开包并处理 CDN/代理失效，不能只改本地目录。策略收缩后不合规历史资源应 404，允许旧标签页需要刷新。
5. 明确可回滚的合规 V2；保留私有旧包与审计证据。历史清理另行执行，不自动删除客户资料或旧证据。

已下载的包与浏览器缓存无法召回；真实能力关闭仍需服务端授权。当前仓库只实现本地部署适配器，没有连接实际生产服务器、CDN 或业务后端。

## 验收边界

本轮实施依据 [V2 技术方案](enterprise-build-pruning-design.md)，P1–P5 已通过本地验收，P6 真实后端待接入。验收同时覆盖真实企业、30 个模块/环境组合、私有依赖和资源负向检查、关闭模块深链、修改开关副本回归、控制台下载包，以及发布策略收缩和不合规回滚拒绝。具体通过范围、产物身份与真实 Nginx/CDN 迁移限制见[整改验证记录](pruning-verification-2026-10-15.md)。

演示身份在 production 模式也不是可信认证，演示页面没有业务 API。物理裁剪解决禁用实现随包交付的问题，不证明真实接口越权已整改，也不保证任何恶意改写的前端都不可运行。
