# Research: V2 报告前端框架迁移

**Feature**: `002-migrate-v2-vue`  
**Date**: 2026-09-15

## Decision 1: Vue 3 单文件组件 + Vite

**Decision**: 使用 Vue 3 单文件组件、Composition API 和 `<script setup>`，所有业务代码使用 JavaScript；使用 Vite 提供开发服务与生产构建。

**Rationale**: 用户已批准 Vue 3 + JavaScript。Vue 官方将 Vite 作为无需服务端渲染项目的直接、简化方案，并使用 Vue 单文件组件作为常规工程结构。本项目是客户端报告页，没有搜索引擎收录或服务端渲染需求。

**Alternatives considered**:

- Vue CDN：初始改动少，但无法自然使用单文件组件，模块和测试体验较弱；同时生产环境依赖外部 CDN，不符合本阶段稳定复用本地资源的目标。
- Vue CLI：已进入维护模式，不作为新迁移项目的首选。
- Nuxt：本项目不需要服务端渲染、文件路由或服务端能力，复杂度超过当前需求。

**Sources**:

- [Vue Quick Start](https://vuejs.org/guide/quick-start)
- [Vue Tooling Guide](https://vuejs.org/guide/scaling-up/tooling)
- [Vite Getting Started](https://vite.dev/guide/)

## Decision 2: Vue Router Hash 单页应用，并兼容旧地址

**Decision**: 使用单个 `index.html` 挂载 Vue 应用，并通过 Vue Router 的 Hash history 管理 `/#/` 与 `/#/system/:systemId`。保留 `detail.html?id=<systemId>` 作为轻量兼容页，将合法系统 ID 转到对应详情路由；缺少 ID 时回到首页。

**Rationale**: 用户已明确批准使用 Vue Router，统一导航层更适合后续增加正式前端页面。Hash 模式不要求静态服务器配置 history fallback，适配当前静态目录和局域网运行方式；旧地址兼容页可保护既有入口、书签和验收路径。

**Alternatives considered**:

- Vite 多页面应用：最接近旧 URL，但随着页面增加会形成多个挂载入口，不利于统一导航与状态恢复。
- `createWebHistory`：URL 更自然，但静态服务器必须为深链接配置 history fallback；当前部署条件未固定，因此不采用。

**Source**:

- [Vue Router — Different History modes](https://router.vuejs.org/guide/essentials/history-mode.html)

## Decision 3: 不引入 Pinia、Axios或 UI 组件库

**Decision**: 报告数据使用只读 ES 模块；页面状态使用组件局部状态、props、computed 和三个小型 composable。静态资源与页面视觉继续使用现有自定义 CSS/SVG。

**Rationale**: 本阶段没有远程接口、登录状态、复杂共享写状态或通用 UI 套件需求。新增全局状态和请求层不会为当前用户场景提供价值。

**Alternatives considered**:

- Pinia：后续接入多报告缓存或跨页面编辑状态时再评估。
- Axios：后续正式对接后台 API 时单独立项。
- Vant/Element Plus：会引入默认样式并增加视觉漂移风险，当前页面已有完整设计系统。

## Decision 4: 共享模拟数据 + 纯函数派生

**Decision**: 将 `window.longevityModules` 转为默认导出的报告对象和系统数组，并以纯函数负责系统查找、重点排序、推荐筛选和图表几何计算。

**Rationale**: 首页与详情必须使用同一数据源；纯函数易于先写失败测试，能直接验证 68 分、系统一致性、重点排序和未知 ID 回退。

**Alternatives considered**:

- 保留全局变量：迁移改动更少，但组件依赖隐式全局，测试隔离和未来接口替换困难。
- 把模拟数据直接写在组件内：会重新制造首页/详情重复和不一致问题。

## Decision 5: CSS 兼容优先，组件化分步进行

**Decision**: 首轮迁移保留现有类名和两个 CSS 文件的层叠顺序，只把 DOM 区域转换为组件；迁移完成并通过视觉对照前，不做样式重命名或设计重构。

**Rationale**: V2 已经确认视觉，且 CSS 约 4,700 行，包含响应式、动效和多个图表。同步重写样式会显著扩大回归面。

**Alternatives considered**:

- CSS Modules/Scoped CSS 全量改写：长期隔离更强，但会改变选择器优先级和动画关联。
- 引入 CSS 框架：无法保证现有视觉像素级延续。

七种系统卡的 DOM 和图表差异明显，本阶段不抽象单一万能卡片。`SystemAtlas.vue` 可以保留各卡片的既有结构并绑定共享数据；可复用的推荐、评分、AI 入口和详情图表边界再独立组件化。

## Decision 6: 项目内静态资源由 `public/` 提供

**Decision**: 需要固定 URL 或直接下载的 PNG 资源放入 `public/`，保留中文文件名和用户可见语义；组件通过根相对资源路径引用。构建后验证全部资源可访问。

**Rationale**: AI 入口和保存报告需要直接指向文件，产品推荐数据还需要稳定的字符串 URL。公开静态目录能在开发和生产构建中保持这些路径。

**Alternatives considered**:

- 所有图片作为模块导入：可生成哈希文件名，但模拟数据与下载地址需要额外映射。
- 保持图片散落在工程根目录：开发服务可能可见，但生产构建不会可靠复制所有直接引用文件。

## Decision 7: Vitest + Vue Test Utils + Playwright

**Decision**: 使用 Vitest 和 Vue Test Utils完成数据与组件测试，使用 Playwright 完成两个真实页面、多视口、下载、导航、减少动态效果和视觉回归测试。

**Rationale**: Vue 官方推荐在 Vite 工程使用 Vitest；当前项目已经有 Playwright 长图脚本和明确的多视口视觉验收需求。两层测试分别覆盖快速逻辑反馈与真实浏览器行为。

**Alternatives considered**:

- 只保留 `render.mjs`：脚本已有过期选择器，不能提供稳定的单元级定位。
- 只做组件测试：无法验证真实下载、导航、响应式溢出和长图空白问题。

**Sources**:

- [Vue Testing Guide](https://vuejs.org/guide/scaling-up/testing)
- [Vitest Guide](https://vitest.dev/guide/)

## Decision 8: V2 使用独立的现代 Node 环境

**Decision**: V2 Vue 工程要求 Node `^22.18.0 || >=24.12.0`；当前可用的 Node 24.14 满足要求。KH503 继续保留其 Node 12 环境，不修改全局兼容配置。

**Rationale**: 当前仓库默认 `node` 为 12.22，无法运行现代 Vue/Vite/Vitest。Vue 当前脚手架要求较新的 Node 版本，而旧 RN 项目又依赖 Node 12，因此必须按子项目隔离运行时。

**Alternatives considered**:

- 为 V2 继续使用 Node 12：与现代 Vue 工具链不兼容。
- 全仓库强制升级 Node：可能破坏 KH503，超出本功能范围。

## Resolved Unknowns

- 不需要服务端渲染或 SEO。
- Vue Router 已获批准并采用 Hash 模式；不需要 Pinia、Axios 和 UI 组件库。
- 不接入后台 API，不建立鉴权或缓存层。
- 保留旧详情 URL 的兼容访问与静态下载行为。
- 使用项目级现代 Node，避免影响旧 RN 环境。
- 所有技术未知项已解决，无 `NEEDS CLARIFICATION` 遗留。

## Current Baseline Findings

- 当前 `render.mjs` 同时承担导图与行为断言，且仍查询已删除的 `.product-recommendation` / `.product-rec-*`，不能直接作为迁移验收脚本。
- 首页最终视觉顺序依赖 CSS `order`，与 HTML 原始顺序不同；迁移后必须由数据流输出正确顺序。
- 当前首页长图为 1170×13326，历史首页设计图为 1170×13650；因此视觉回归必须结合内容、几何和截图差异，不能只比较固定高度。
- 页脚存在为固定 AI 胶囊预留的安全区。390 像素视口下尾部安全留白允许保留，但不得超过 140 CSS 像素。
- 当前说明按钮没有交互、AI 页面只是 PNG、保存按钮下载预生成 PNG；本阶段保持这些既有业务边界，不扩展新功能。
