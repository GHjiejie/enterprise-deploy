# 企业定制前端架构设计方案

**方案定位：一套代码，按企业配置独立构建、独立部署。**

本文以前端模块开关在构建时确定为前提：企业 A 不开放图片生成和视频生成体验模块，企业 B 可以保留它们。功能配置变更通过重新构建、测试和发布生效，不引入运行时功能配置平台。

构建实现以 Vite + TypeScript 为例。菜单组件和路由装配接入项目现有的 React、Vue 或其他实现；本文不要求更换业务框架。配置和目录为建议设计，不代表当前项目已经具备这些能力。

## 1. 架构决策与交付边界

| 决策项 | 本方案选择 |
|---|---|
| 代码维护 | 共用一套主干代码；不为隐藏两个模块维护长期客户分支 |
| 企业差异 | 通过版本化企业配置文件表达 |
| 配置生效 | 构建时读取，变更后重新构建和发布 |
| 构建产物 | 不同企业、不同环境分别输出和标识 |
| 功能控制 | 模块注册、菜单、路由及其他入口统一使用模块开关 |
| 用户权限 | 沿用运行时身份与权限体系，不固化到企业构建配置 |
| 服务端能力 | 服务端独立校验，不信任前端开关 |
| 代码物理裁剪 | 初版不作保证；交付要求明确时单独实现并验收 |

本次基础交付的验收边界定义为：企业 A 的正常应用界面不展示图片生成、视频生成的体验入口；直接访问对应页面或子页面也不进入模块。API 能力是否关闭、模型列表是否隐藏相关模型、历史记录如何处理，分别确认，不从“体验模块关闭”自动推导。

前端模块开关是产品装配规则，不是安全授权。客户端检查不能作为授予或拒绝资源访问的最终依据。[^owasp-auth]

## 2. 总体组成与职责

```text
公共业务代码 + 指定企业配置 + 环境配置
                    ↓
            构建前校验与配置解析
                    ↓
           注入本企业的公开构建常量
                    ↓
            按模块开关装配应用
                    ↓
         企业专属静态产物 + 发布记录
                    ↓
          对应企业、对应环境的部署
```

| 组成部分 | 职责 | 不应承担的职责 |
|---|---|---|
| 企业配置 | 声明本次交付开放哪些模块 | 保存密钥、决定用户身份 |
| 构建层 | 选择配置、校验、注入常量、输出产物 | 编写业务页面逻辑 |
| 模块定义 | 声明模块入口、路由、导航、权限标识、必要依赖 | 判断具体客户名称 |
| 应用装配层 | 汇总已启用模块，生成路由与导航，提供统一查询函数 | 代替后端授权 |
| 业务模块 | 实现对话、图片、视频等功能 | 自行创建另一套企业开关 |
| 发布流水线 | 测试构建、核对交付目标、归档、部署、回滚 | 默认将任何失败降级为全量功能 |

前端内部建议使用两条规则：

```text
本版本开放模块 = 企业构建配置明确启用
用户可进入模块 = 本版本开放模块 AND 当前用户具备页面权限
```

企业开关在该构建版本中固定，登录状态、用户权限和业务数据仍可以在运行时变化。企业管理员的角色权限不能反向打开该版本关闭的模块。

## 3. 目录与代码边界

```text
project/
├── config/
│   └── profiles/
│       ├── standard.json
│       ├── enterprise-a.json
│       └── enterprise-b.json
├── shared/
│   └── build-profile.ts          # 构建层、前端共用的配置类型和模块标识
├── build/
│   ├── load-profile.ts           # 读取并严格校验配置
│   └── release-record.ts         # 发布记录生成逻辑，接入 CI 时实现
├── src/
│   ├── app/
│   │   ├── module-registry.ts    # 汇总模块定义
│   │   ├── router.ts             # 用已启用模块装配路由
│   │   └── navigation.ts         # 用相同模块集合生成导航
│   ├── platform/
│   │   ├── features.ts           # 统一模块开关查询
│   │   ├── permissions.ts        # 现有用户权限体系的适配
│   │   └── navigation-service.ts # 模块跳转及默认入口规则
│   ├── modules/
│   │   ├── model-catalog/
│   │   ├── chat/
│   │   ├── image-studio/
│   │   └── video-studio/
│   └── shared/                  # 上传、预览、表单等公共能力
├── tests/
│   ├── profiles/                # 配置、组合规则与装配测试
│   └── delivery/                # 企业产物的交付冒烟测试
├── .env.staging
├── .env.production
└── vite.config.ts
```

示例只展开模型广场与三个体验模块。用户中心、费用管理等既有模块，应按实际情况保留为基础模块或接入同一套注册规则。

模块内部可以有页面、接口封装、状态和私有组件，但不要在模块导入时立即发送业务请求、启动轮询或注册全局业务副作用。需要初始化的模块，应由装配层在确认启用后显式启动，并具备清理逻辑。

共享能力不应依赖可关闭模块。例如对话上传图片需要复用的上传组件，应放入 `src/shared`，而不是从 `image-studio` 内部导入。

## 4. 企业配置模型

### 4.1 用结构化文件表达企业功能组合

企业 A 的配置：

```json
{
  "schemaVersion": 1,
  "id": "enterprise-a",
  "modules": {
    "modelCatalog": true,
    "chat": true,
    "imageStudio": false,
    "videoStudio": false
  },
  "defaultModule": "modelCatalog"
}
```

文件位置为 `config/profiles/enterprise-a.json`。企业 B 使用自己的完整配置文件；初版不引入多层继承和隐式覆盖，以便直接审查每一家企业的最终功能组合。

`imageStudio`、`videoStudio` 特意表示在线体验模块，而不是底层 API 能力。配置中的 `id` 是交付版本标识，不能用作可信的企业身份凭据。

### 4.2 分离企业、环境和用户三个维度

| 维度 | 示例 | 来源 |
|---|---|---|
| 企业交付配置 | 是否开放图片生成体验模块 | `APP_PROFILE` 选择 JSON 配置 |
| 部署环境配置 | 测试、生产及对应的非敏感连接参数 | Vite `--mode` 与环境配置 |
| 用户权限 | 某个用户能否查看、创建或管理任务 | 登录后的服务端权限信息 |

简单项目可以直接使用 `.env.enterprise-a`。本设计进一步把企业选择与部署环境分开，避免形成大量 `.env.enterprise-a-production`、`.env.enterprise-a-staging` 组合文件。Vite 的模式和环境变量加载是构建工具机制；企业配置文件及 `APP_PROFILE` 则是本方案定义的约定。[^vite-env]

### 4.3 构建前严格校验

缺少 `APP_PROFILE`、指定的文件不存在、JSON 不合法、配置版本不支持、未知字段、模块字段缺失、布尔值写成字符串，均应直接使构建失败。不要失败后默认使用标准版或全功能版。

所有模块必须显式填写 `true` 或 `false`。新增模块时，所有受支持的企业配置都要经过一次明确决策；未确认的企业填写 `false`，不能通过公共默认值自动获得新模块。

默认入口必须指向已启用模块。配置校验之后，还要通过模块注册表校验它确实存在可跳转入口，以及已启用模块的必要依赖是否满足。

企业配置目录不能放在前端的 `public/` 下。Vite 会把该目录中的资源原样复制到构建输出；本设计只把当前企业经过校验的公开字段注入业务产物，不发布完整配置仓库。[^vite-public]

浏览器配置可以被查看。密码、模型供应商密钥、服务端令牌都不能放进它；Vite 文档也明确警告不要把秘密放在客户端可见的 `VITE_*` 环境变量中。[^vite-env]

## 5. 构建注入与本地开发

使用 Vite 的 `define` 注入 `__BUILD_PROFILE__`。该机制支持开发时的全局常量，以及构建时的静态替换，不需要浏览器请求一个运行时功能配置接口。[^vite-define]

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { loadBuildProfile } from "./build/load-profile";

export default defineConfig(({ mode }) => {
  if (!["development", "staging", "production"].includes(mode)) {
    throw new Error(`不支持的环境模式：${mode}`);
  }

  const profile = loadBuildProfile(process.env.APP_PROFILE);

  return {
    // 接入现有项目时，保留原有框架插件、别名和代理配置。
    define: {
      __BUILD_PROFILE__: JSON.stringify(profile),
    },
    build: {
      outDir: `dist/${profile.id}/${mode}`,
    },
  };
});
```

`loadBuildProfile` 的完整校验示例见附录。它在构建进程中读取 JSON，只返回已校验的公开字段；不要把 `process.env` 整体序列化给前端。

本地开发和发布构建使用同一条配置解析链路：

```bash
# 以下是 macOS / Linux shell 示例；CI 中可以使用任务的环境变量设置。
APP_PROFILE=enterprise-a npx vite
APP_PROFILE=enterprise-a npx vite build --mode staging
APP_PROFILE=enterprise-a npx vite build --mode production
APP_PROFILE=enterprise-b npx vite build --mode production
```

企业 A 的生产构建输出至 `dist/enterprise-a/production/`。CI 还应把工具链版本、依赖锁文件、源代码提交以及构建命令纳入发布记录。

修改企业功能配置后，必须重新构建、测试和发布。修改本地配置时重启开发服务器，避免构建常量与调试页面不一致。该方案不承诺对已经打开的旧版本页面即时生效。

## 6. 前端模块装配

### 6.1 统一查询接口

```typescript
// src/platform/features.ts
import type { BuildProfile, ModuleId } from "../../shared/build-profile";

// 由 Vite define 提供值；declare 只声明类型，不提供运行时实现。
declare const __BUILD_PROFILE__: BuildProfile;

export const buildProfile = __BUILD_PROFILE__;

export function isModuleEnabled(moduleId: ModuleId): boolean {
  return buildProfile.modules[moduleId] === true;
}
```

业务组件只询问 `isModuleEnabled("imageStudio")`，不再判断 `profile.id === "enterprise-a"`，也不直接读取各种环境变量。

### 6.2 模块注册表是菜单和路由的共同来源

每个模块的 `module.ts` 建议声明以下信息：

| 字段 | 含义 |
|---|---|
| `id` | 稳定的模块标识 |
| `navigation` | 可选的导航标题、分组、排序及入口路由名 |
| `routes` | 本模块拥有的路由及子路由，接入现有路由库 |
| `viewPermission` | 页面展示所需的用户权限标识 |
| `dependsOn` | 必须同时启用的模块依赖；没有则为空 |
| `activate / dispose` | 可选的显式初始化和清理入口 |

装配过程为：汇总模块定义 → 用构建开关得到已启用模块集合 → 验证依赖和默认入口 → 注册该集合的路由 → 生成该集合的导航 → 叠加当前用户权限。

这里的 `navigation` 可以为空，路由不能因此被判定为不可访问。详情页、不在菜单中的功能页，同样可以属于一个已启用模块。

**关闭模块时，初版选择不注册该模块的业务路由。** 未知路由交给统一的页面不存在处理；已启用但用户无权访问的页面，走现有的登录或无权限流程。静态单页应用显示“页面不存在”，不一定表示 HTTP 响应状态就是 404；需要真实 HTTP 404 时由服务器或相应渲染层配合。

路由装配必须覆盖嵌套路由、别名、详情页、历史重定向，以及类似 `/playground/:type` 的通用页面分支。若某个通用路由能进入多个模块，还要在加载模块页面和发出专属业务请求之前检查目标模块。

对于使用路由数据加载器或自动预加载的项目，还应在加载器或预加载决策处检查权限，不能只等页面组件渲染后才拦截。

### 6.3 所有可见入口都要接入

| 页面位置 | 本次改造要求 |
|---|---|
| 左侧导航 | 不渲染图片生成、视频生成；过滤后移除空分组 |
| 路由及子页面 | 不注册已关闭模块的业务路由，避免 URL 绕过 |
| 模型卡片体验按钮 | 不生成指向关闭模块的入口 |
| 首页快捷入口、搜索结果 | 按目标模块过滤 |
| 默认首页 | 从有效默认模块进入；用户无权限时选择有权限的入口，否则显示无可用功能页面 |
| 历史链接和通知跳转 | 校验目标模块；不可用时提示，而非加载旧模块 |
| 预加载、轮询和初始化 | 不为已关闭模块启动相关业务行为 |

这套机制不会自动找到现有页面中的所有硬编码入口，接入时必须对上述入口做一次检查和迁移。

### 6.4 模型广场的边界单独处理

关闭图片生成体验模块时，模型广场可以仍展示支持图片生成的 API 模型，但不展示相应在线体验入口；也可以按客户约定连模型卡片一起隐藏。这是两个不同的交付要求，不应混用同一个开关而不作说明。

需要隐藏卡片时，应根据服务端模型元数据中的明确能力字段处理，而不是通过模型名称中是否包含 `image` 或 `video` 猜测。涉及禁止访问的模型信息，应同时由服务端控制返回范围。

智能对话中的图片理解、文件上传和预览，不属于图片生成体验模块，不能因为 `imageStudio = false` 一并删除。

## 7. 服务端协同与安全边界

本方案把页面装配与功能授权分开：

| 控制项 | 负责方 | 示例 |
|---|---|---|
| 前端体验模块 | 企业构建配置 | `imageStudio`、`videoStudio` |
| 服务端业务能力 | 服务端部署或企业授权策略 | `image.generate`、`video.generate` |
| 调用者权限 | 现有身份和权限体系 | 用户或 API Key 是否可执行某项操作 |

只要求关闭在线体验页面时，不必禁止客户已购买的 API。若要求彻底禁止生成能力，则服务端必须独立校验实际执行入口，包括网页登录、API Key 和其他实际存在的调用方式。授权检查应覆盖每个请求，而不是信任前端是否显示入口。[^owasp-auth]

服务端应从验证过的登录身份、企业成员关系或 API Key 授权得到企业范围。浏览器传来的 `profileId`、`tenantId` 或模块布尔值不能直接作为授权依据。[^owasp-tenant]

前后端配置不必字段同名或机械相等，但必须与同一份交付约定一致。例如“无在线体验，但允许 API”就是合法组合。把这个组合规则纳入发布核对，而不是把服务端密钥与部署秘密塞进前端 JSON。

关闭能力不会自动删除历史数据或取消进行中的任务。新增任务、历史查看、下载和进行中任务如何处理，由产品与后端单独约定。

## 8. 关闭模块与物理裁剪

### 8.1 初版只承诺行为关闭

模块未出现在菜单、路由不可进入，并不能证明相关 JS、CSS 或资源文件已经从交付包消失。尤其是将全部模块放入动态导入列表、再过滤启用项的实现，不能据此承诺物理裁剪。Vite 的 glob 导入文档说明，匹配到的懒加载模块通常会在构建时形成独立代码块。[^vite-glob]

因此，初版交付承诺是“正常应用路径中不开放这些体验模块”，不是“客户无法在产物中找到相关实现”。

### 8.2 明确要求不交付代码时再增加裁剪流程

构建阶段按企业配置生成唯一的模块装配入口。例如企业 A 生成：

```typescript
// 示例：src/generated/active-modules.ts
import { modelCatalogModule } from "../modules/model-catalog/module";
import { chatModule } from "../modules/chat/module";

export const activeModules = [modelCatalogModule, chatModule];
```

应用必须只从生成入口装配模块，不再同时导入全量注册表。构建生成文件不允许手工修改；并发构建不同企业时，应使用隔离工作目录或独立 CI 作业，避免互相覆盖。

同时排查共享代码、全局样式、统一国际化资源、worker、静态资源复制和 source map 是否把禁用模块重新带入产物。`public/` 下的文件不会因为模块关闭自动被排除，应按交付资源清单管理。[^vite-public]

裁剪验收应结合构建依赖信息和实际输出资源检查，而不是只搜索文件名。共享库被保留不代表裁剪失败；需要事先界定哪些是禁用模块的专属实现和资源。即使前端物理裁剪通过，也不能替代服务端授权。

## 9. 构建、发布和回滚

### 9.1 标准发布流程

```text
提交代码或企业配置
  → 校验所有受支持的企业配置
  → 类型检查、基础测试、模块装配测试
  → 使用指定企业和环境构建
  → 针对该产物进行交付冒烟测试
  → 生成发布记录与制品摘要
  → 核对企业、环境及后端兼容条件
  → 归档并部署对应产物
  → 线上核验
```

企业配置变更通过代码评审，产品或交付负责人确认功能范围，前端负责人确认技术影响。未明确确认的模块不自动开放。

生产构建在隔离环境中执行，避免本地 `.env.local` 或残留生成文件影响交付。依赖安装缓存可以复用，但不要把企业 A 的构建输出当作企业 B 的结果复用。

### 9.2 发布记录

每份产物至少记录以下非敏感信息：

| 字段 | 用途 |
|---|---|
| 企业配置 ID 与环境 | 防止把正确代码部署给错误客户或错误环境 |
| 应用版本与代码提交 | 追溯实现 |
| 配置版本与配置摘要 | 追溯当时的模块组合 |
| 已启用模块清单 | 交付核对 |
| 构建任务 ID、工具链和依赖锁文件摘要 | 排查构建差异 |
| 产物摘要 | 确认部署的是经过测试的产物 |
| 后端兼容条件或策略版本 | 需要前后端配合时核对 |

发布流水线应把目标企业和环境与产物元数据比较，不一致则拒绝部署。产物摘要用于一致性校验；供应链来源可信性需要依靠受控 CI、制品库及相应签名或权限机制，不能仅靠一个可被替换的清单文件。

### 9.3 回滚与浏览器缓存

回滚使用已归档的上一份本企业产物，不通过临时修改线上压缩 JS 完成。涉及服务端策略变化时，先核对兼容性；前端回滚不应自动撤销服务端的数据或安全策略。

本方案不保证已经打开的旧页面立即消失。需要立即禁止使用时，服务端应先执行限制；前端可以提示刷新或在已有更新机制中切换版本。

静态发布应避免新旧 HTML 与资源混用。Vite 文档指出，旧页面在新部署后仍可能尝试请求旧的动态导入资源；建议为 HTML 使用重新验证策略，并结合原子切换、旧资源保留期或加载失败恢复措施处理。[^vite-deploy]

## 10. 测试和验收清单

| 场景 | 预期结果 |
|---|---|
| 企业 A 构建：图片、视频关闭 | 菜单、快捷入口、相关体验按钮均不展示 |
| 企业 A 直接访问生成页面及其子路由 | 不进入模块，不启动其专属业务请求 |
| 企业 A 管理员登录 | 不能通过用户角色打开构建时关闭的模块 |
| 企业 B 构建：两个模块开启 | 有权限用户正常进入和使用 |
| 企业 B 用户缺少页面权限 | 导航与页面按用户权限处理，服务端继续独立校验 |
| 图片关闭、视频开启等实际交付组合 | 不误伤另一个模块或公共上传组件 |
| 模型广场和历史入口 | 按已确认的产品范围处理，不存在隐藏入口绕过 |
| 默认模块关闭或依赖缺失 | 构建或模块装配校验失败，不生成可发布产物 |
| 企业配置缺失、拼写错误、类型错误 | 构建失败，不降级为全功能 |
| 新增模块但企业配置未同步 | 校验失败，要求显式选择 |
| 企业产物与部署目标不符 | 发布任务拒绝部署 |
| 服务端约定禁止生成能力 | 不依赖前端页面，直接调用 API 也被拒绝 |
| 升级与回滚 | 版本、配置和页面行为一致，旧资源处理符合发布策略 |
| 开启物理裁剪要求时 | 依赖和输出资源检查通过，禁用专属代码及资源未交付 |

不必测试全部理论上的布尔组合，但每个实际交付配置必须经过相应回归和产物冒烟测试。新增模块或修改公共装配逻辑时，扩大受影响配置的测试范围。

## 11. 实施顺序与后续扩展

**第一阶段：建立最小可交付闭环。** 引入企业 JSON、严格校验和构建注入；抽取统一开关；将图片、视频的菜单、路由及其他入口接入。保留已有业务实现和权限体系，不为此引入微前端或完整多租户配置中心。

**第二阶段：固化企业交付流程。** 为已支持的企业配置增加测试与构建任务，记录版本和配置摘要，建立部署目标校验与回滚流程。

**第三阶段：按真实需求扩展。** 品牌差异加入独立品牌配置；参数差异使用经过校验的业务配置；审批或存储对接差异使用明确适配接口；只有出现不交付相关代码的要求时，增加模块入口生成和物理裁剪。

未来若变成“多家企业共用同一份前端应用，登录后切换功能”，可以保留模块标识和统一查询接口，将企业开通信息增加为运行时来源。但那是新的架构条件，不纳入本次初版。

## 12. 本次交付的最终定义

最终建立的是“企业版本装配机制”，而不是两个零散的菜单条件：

> 新增一个企业，主要工作应是新增配置、验证模块组合、运行对应构建与发布；公共页面不需要再次修改客户名称判断。

当前基础方案保证统一的页面和入口行为、可追溯的企业产物以及与服务端权限的明确分工。它不自动提供运行时热切换、不自动保证代码物理裁剪，也不改变已经约定的 API 商业权益。

## 附录：配置类型与构建校验示例

以下文件用于前述构建注入机制。接入时保留现有项目的 TypeScript、Node 类型和 Vite 框架插件设置；业务模块装配、CI 发布记录和端到端测试需要结合现有项目实现。

### A. 配置类型

```typescript
// shared/build-profile.ts
export const MODULE_IDS = [
  "modelCatalog",
  "chat",
  "imageStudio",
  "videoStudio",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export interface BuildProfile {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly modules: Readonly<Record<ModuleId, boolean>>;
  readonly defaultModule: ModuleId;
}
```

### B. 严格读取与校验

```typescript
// build/load-profile.ts —— 只在构建进程中运行，不导入浏览器代码
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MODULE_IDS,
  type BuildProfile,
  type ModuleId,
} from "../shared/build-profile";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value);
  if (
    actual.length !== expected.length ||
    actual.some((key) => !expected.includes(key))
  ) {
    throw new Error(`${label} 字段不完整或包含未知字段`);
  }
}

function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" &&
    (MODULE_IDS as readonly string[]).includes(value);
}

export function parseBuildProfile(
  value: unknown,
  expectedId: string,
): BuildProfile {
  if (!isRecord(value)) throw new Error("企业配置必须是 JSON 对象");

  checkKeys(value, ["schemaVersion", "id", "modules", "defaultModule"], "企业配置");
  if (value.schemaVersion !== 1) throw new Error("不支持的配置版本");
  if (value.id !== expectedId) throw new Error("配置 id 与构建目标不一致");

  if (!isRecord(value.modules)) throw new Error("modules 必须是对象");
  checkKeys(value.modules, MODULE_IDS, "modules");

  const entries: Array<[ModuleId, boolean]> = [];
  for (const id of MODULE_IDS) {
    const enabled = value.modules[id];
    if (typeof enabled !== "boolean") {
      throw new Error(`modules.${id} 必须是布尔值`);
    }
    entries.push([id, enabled]);
  }
  // 上面的遍历已校验并覆盖 MODULE_IDS 的每一个键。
  const modules = Object.fromEntries(entries) as Record<ModuleId, boolean>;

  if (!isModuleId(value.defaultModule) || !modules[value.defaultModule]) {
    throw new Error("defaultModule 必须是一个已启用模块");
  }

  // 只返回经过校验的公开字段，不把其他构建环境变量传给浏览器。
  return {
    schemaVersion: 1,
    id: expectedId,
    modules,
    defaultModule: value.defaultModule,
  };
}

export function loadBuildProfile(profileId: string | undefined): BuildProfile {
  if (!profileId || !/^[a-z][a-z0-9-]{0,63}$/.test(profileId)) {
    throw new Error("必须显式指定合法的 APP_PROFILE，例如 enterprise-a");
  }

  const path = fileURLToPath(
    new URL(`../config/profiles/${profileId}.json`, import.meta.url),
  );

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`无法读取或解析企业配置：${profileId}`);
  }

  return parseBuildProfile(raw, profileId);
}
```

此示例校验配置结构、模块开关和默认模块的启用状态。模块路由是否存在、模块间依赖、前后端交付组合等业务规则，应另外由模块装配测试与发布校验实现。

## 技术依据

[^vite-env]: Vite 官方文档，Env Variables and Modes：环境变量、模式、构建时替换及客户端秘密保护。https://vite.dev/guide/env-and-mode
[^vite-define]: Vite 官方文档，Shared Options / define：开发时全局定义和构建时静态替换。https://vite.dev/config/shared-options#define
[^vite-public]: Vite 官方文档，Static Asset Handling / The public Directory：公共目录资源原样复制。https://vite.dev/guide/assets#the-public-directory
[^vite-glob]: Vite 官方文档，Features / Glob Import：动态导入与构建代码块。https://vite.dev/guide/features#glob-import
[^owasp-auth]: OWASP Authorization Cheat Sheet：客户端检查不是授权边界，应逐请求执行适当授权。https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
[^owasp-tenant]: OWASP Multi-Tenant Security Cheat Sheet：企业范围应绑定经过验证的身份和授权关系。https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html
[^vite-deploy]: Vite 官方文档，Building for Production / Load Error Handling：旧页面、动态导入及发布缓存处理。https://vite.dev/guide/build#load-error-handling
