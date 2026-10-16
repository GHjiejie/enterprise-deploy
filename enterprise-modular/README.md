# 前端多企业定制与构建时模块裁剪

依据《前端多企业定制与构建时模块裁剪 架构设计文档 v1.0》实现的独立 Vue 3 + TypeScript + Vite 应用。企业白名单在 Node 构建端完成校验，生成唯一静态模块入口；浏览器只消费本次已装配模块。源码边界、应用和 Worker 构建图、最终目录和压缩包均有校验。

企业 A 包含订单、报表和订单导出，企业 B 只包含订单。B 的报表页面、导出组件、API 适配器、CSV 算法、Worker、样式和专属图片均不进入交付图与文件。订单页通过中立扩展点消费工具，不引用导出实现。

这是可运行的架构实现与本地交付工具。订单、报表、导出适配器使用明确标记的演示数据；未提供业务后端、真实身份协议或线上发布目标。服务端逐请求授权、CDN 清理和真实环境联调仍需在接入相应系统后完成。

## 运行

企业配置与打包支持可视化控制台。启动后可以在 UI 中新建或选择企业、勾选模块、选择品牌与环境，查看真实流水线并下载制品：

```bash
cd enterprise-modular
npm run configure
```

打开 <http://127.0.0.1:5193>，点击「保存并打包」。完整操作和任务快照说明见 [可视化企业配置与打包](docs/build-console.md)。

需要 Node.js 22.12+ 或 24+、npm，以及系统 `tar`（支持 GNU tar / macOS bsdtar）。所有直接依赖均锁定版本，使用本目录的 `package-lock.json`。

从仓库根目录执行：

```bash
cd enterprise-modular
npm ci

# 必须显式选择企业；没有默认全功能降级
APP_ENTERPRISE=enterprise-a npm run dev
# 或 APP_ENTERPRISE=enterprise-b npm run dev
```

开发地址为 <http://127.0.0.1:5190>。修改企业清单后重启开发服务。开发服务用于本地编码；交付验收运行封包后的生产站点。

| 企业         | 订单 | 报表 | 订单导出 | 品牌    |
| ------------ | ---- | ---- | -------- | ------- |
| enterprise-a | 开启 | 开启 | 开启     | brand-a |
| enterprise-b | 开启 | 关闭 | 关闭     | brand-b |

页面中的「演示权限」支持管理员、普通成员和无权限身份。可见功能取已交付能力、运行时服务许可集合、用户权限的交集；演示身份不能代替真实认证或服务端授权。

## 构建、审计和封包

```bash
# release-id 可省略，此时生成 UUID；手工指定时必须每次使用新的 ID
npm run build -- --enterprise enterprise-a --mode production --release-id local-a-001
npm run audit -- --enterprise enterprise-a --release-id local-a-001
npm run package -- --enterprise enterprise-a --release-id local-a-001
npm run preview -- --enterprise enterprise-a --release-id local-a-001 --port 5191

npm run build -- --enterprise enterprise-b --mode production --release-id local-b-001
npm run package -- --enterprise enterprise-b --release-id local-b-001
npm run preview -- --enterprise enterprise-b --release-id local-b-001 --port 5192
```

`mode` 支持 `development`、`staging`、`production`；企业与环境分开选择。生产和 staging 构建明确固定框架的生产条件，不受调用进程的 `NODE_ENV=test` 影响。`.env.local` 和对应环境的 `.local` 覆盖文件被拒绝，公开环境变量使用 `PUBLIC_` 前缀。

构建入口先校验完整目录表、企业依赖闭包和本次可达源码，再执行严格类型检查。随后创建独占的任务目录，为应用和每个 Worker 创建新的插件实例，采集来源并在写盘后校验全部文件。源码或策略在构建期间变化、未知输入、禁用 owner、缺失 Worker 上下文、输出碰撞、文件集合或哈希变化均使构建失败。

直接 `vite build` 被拒绝，必须使用完整协调器。相同 release ID 不能复用；失败任务保留私有诊断且没有可交付资格，重试使用新 ID。无需写入共享的 `src/generated` 文件，因此 A/B 可并行构建。

```text
.work/<enterprise>/<release-id>/site/       本次待审计站点
.audit/<enterprise>/<release-id>/audit.json 私有来源、上下文、文件与哈希证据
.audit/<enterprise>/<release-id>/package.json 私有包摘要与审计绑定
.artifacts/<enterprise>/<release-id>.tar.gz 可传输站点包
release/<enterprise>/<release-id>/site/     封包后冻结的站点文件
```

站点与压缩包仅含批准文件。完整模块目录、其他企业配置、绝对源码路径、完整审计报告和 source map 不放入客户站点。包记录绑定审计报告摘要、站点摘要和 `.tar.gz` 摘要。复验还读取压缩包中的每个普通文件，与批准哈希逐项比较，拒绝额外目录、路径穿越、软链接、缺失文件、篡改内容和遗留压缩副本。

## 本地发布和回滚

```bash
npm run publish -- --target local-enterprise-a --release-id local-a-001
npm run publish -- --target local-enterprise-b --release-id local-b-001
```

发布目标必须登记在 `config/delivery-targets.json`，并独立声明企业、品牌和允许模块上限。发布端复验已封包制品，从同一份已校验的压缩包字节提取内容；不重新构建。仅 `production` 制品可进入发布适配器。

版本保存在私有 `.deploy/<target>/`，通过原子替换 `deployments/<target>/current` 符号链接切换。目标目录只暴露 `current`，旧版本和私有部署记录保存在其外。Web 服务器的根目录必须指向 `current`，不要公开整个仓库或 `.deploy`。每个目标有独占发布锁。

回滚使用同一条 `publish` 命令和历史 release ID，并重新执行所有门禁。历史制品必须与当前企业配置、构建策略和锁定工具链兼容；策略变化时采用重新构建的方式恢复合规版本。企业许可收缩后，旧的全功能制品会被拒绝。浏览器已保存的历史代码无法撤回；真实 CDN、Service Worker 和远端存储的失效操作需要相应部署适配器。

预览服务冻结已验证字节，只监听 `127.0.0.1`。HTML 深链支持 SPA 回退，缺失 JS、CSS、图片和私有文件始终返回 404，便于准确验证旧资源地址。

## 代码组织

| 路径                         | 职责                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `config/enterprises/`        | schemaVersion 1 企业白名单，不隐式继承                       |
| `config/module-catalog.json` | 入口、能力依赖、互斥、业务归属根和批准包                     |
| `config/brands.json`         | 企业品牌资源登记                                             |
| `build-console/src/`         | 企业配置、模块选择、构建进度、历史和制品下载界面             |
| `build/console/`             | 本机配置 API、版本冲突校验、项目快照和真实构建任务           |
| `build/policy/manifest.ts`   | 纯数据校验、路径验证、依赖排序与配置摘要                     |
| `build/policy/origin.ts`     | file URL、别名解析后的真实路径、查询后缀、软链接和生成器归属 |
| `build/policy/scan.ts`       | TS / Vue / CSS 可达源码扫描和优化前边界检查                  |
| `build/plugins/registry.ts`  | 唯一静态业务入口与品牌入口                                   |
| `build/plugins/guard.ts`     | 应用 / Worker 图守卫、分块模块与资产来源采集                 |
| `build/audit/`               | 审计协议运行时校验、上下文合并、文件对账、哈希验证           |
| `build/enterprise.ts`        | 隔离构建协调器                                               |
| `build/package.ts`           | 批准文件封包与归档内容复验                                   |
| `build/publish.ts`           | 企业目标约束、同字节制品发布与原子切换                       |
| `src/contracts/`             | 中立功能、页面、菜单、订单工具与导出消息契约                 |
| `src/composition/`           | 唯一模块汇总、冲突检测与显式生命周期                         |
| `src/core/`                  | 工作台壳、404、权限交集与加载失败提示                        |
| `src/shared/`                | 通用格式化工具                                               |
| `src/modules/`               | orders / reports / order-export 的私有实现和资源             |
| `tests/architecture/`        | 结构、反向引用、真实构建、封包、目标与篡改用例               |
| `tests/e2e/`                 | 封包后生产站点浏览器验收                                     |
| `tests/console/`             | 控制台配置、快照、API 与浏览器完整打包验收                   |

业务模块可以依赖自身实现、中立契约、通用组件和基础服务，不能导入其他业务模块实现。核心和共享层不能反向导入业务。完整业务注册表只能被 composition 消费。`order-export requires orders` 只表示安装依赖，其按钮仍通过 `OrderToolContext` 取得订单快照。

模块入口仅描述能力。`activateModules` 按装配顺序显式启动，失败时回收已启动模块，清理按相反顺序执行且幂等；页面请求和导出 Worker 在组件卸载时取消或销毁。扩展为空时订单页面仍可独立运行。

## 扩展企业或能力

新增企业时，添加完整企业 JSON，并在品牌目录表中登记资源。参与发布时，另行登记受控的目标模块上限。未知企业、未知模块、重复 ID、未知字段、缺失依赖、依赖环、互斥组合、重叠归属和无归属入口均会失败，不自动补开模块。

新增模块时，将页面、按钮、API、算法、样式、图片、Worker 和专属包放在同一归属边界内，更新纯数据目录表和企业白名单，并补齐正反向测试。专属工作区包要登记在 `ownedRoots`；真实路径归属优先于通用 node_modules 批准规则。新增第三方包需明确批准，不能把整个 node_modules 当作共享白名单。

当前实现支持 Vue SFC、TypeScript、普通 CSS、源码引入的静态资产及 Vite ES Worker。应用与实际 Worker 分别提交成功记录；SSR、Service Worker 和独立入口登记为不适用。未经适配的 SSR / SW 加载、SharedWorker、Wasm、CSS 预处理器、自定义 SFC 块、远程代码加载、计算动态导入、glob 扫描和未知虚拟模块会被拒绝。`publicDir` 全量复制、资产内联、交付 source map 与预压缩副本关闭。需要扩展这些形式时，应同时增加来源适配器和反向验收。

审计以受控工具链、真实来源登记和私有记录可信为前提。不能自动判断被人工复制进 shared 的业务语义，也不能防御任意恶意构建插件；构建脚本、目录表、企业配置、锁文件和私有审计记录需要纳入仓库与制品权限管理。

## 验证

本次执行结果、A/B 制品摘要和文档 T-01 至 T-12 的对应证据记录在 [架构实现验证记录](docs/verification-2026-10-16.md)。

```bash
npm run check
npx playwright install chromium
npm run test:e2e
npm run test:console
```

`check` 包含格式、严格类型、全部企业源码边界和 Vitest。测试执行全部五种合法非空能力组合的真实生产构建、staging 验证、A/B 并行构建，以及配置非法、别名 / 软链接 / barrel / raw / CSS / 死分支 / Worker 绕过、未知输出、额外 map / gz / br、篡改文件 / 审计 / 压缩包、目标上限和许可收缩等用例。

Playwright 自动构建并封包 A/B，针对冻结生产文件测试订单、选择导出、报表资源、B 深链和网络请求、权限切换、搜索空态恢复、390px 窄屏、分块加载失败提示。两个本地测试端口为 5191 / 5192。

仓库根目录的 `.github/workflows/enterprise-modular.yml` 提供独立 CI 作业，只在本项目或该 workflow 变更时触发，上传私有审计、压缩包和浏览器报告。真实后端授权与远端缓存失效测试需要在后端、身份服务和线上部署适配器接入后执行。

实现按锁定的 Vite 8 / Rolldown 接口适配。虚拟入口遵循 [Vite Plugin API](https://vite.dev/guide/api-plugin)；Worker 使用独立插件工厂，依据 [Vite Worker Options](https://vite.dev/config/worker-options)；资产复制与映射设置参见 [Vite Build Options](https://vite.dev/config/build-options)。升级工具链后应重跑完整反向集合与生产浏览器测试。
