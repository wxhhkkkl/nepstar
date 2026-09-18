# Implementation Plan: V2 报告前端框架迁移

**Branch**: `002-migrate-v2-vue` | **Date**: 2026-09-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-migrate-v2-vue/spec.md`

## Summary

将 `reportFront/report-v2` 从直接操作 DOM 的静态页面迁移为 Vue 3 + JavaScript 前端，同时保持当前首页、七类系统详情、68 分警示、重点系统排序、两项产品推荐、AI 咨询入口、保存长图、滚动恢复和响应式表现不变。

采用 Vite 单页应用与 Vue Router Hash 路由：`index.html` 挂载统一 Vue 应用，报告首页与系统详情页分别由路由管理；旧 `detail.html?id=<systemId>` 保留为轻量兼容跳转入口。模拟报告数据迁移为 ES 模块，首页与详情共享同一数据源；不引入 Pinia、Axios、后台接口或 UI 组件库。现有 CSS 类名和视觉资源先原样保留，按业务区域拆成小型组件，以最低风险完成等价迁移。

## Technical Context

**Language/Version**: JavaScript（现代 ECMAScript）、Vue 3 单文件组件；禁止 TypeScript  
**Primary Dependencies**: Vue 3、Vue Router、Vite、`@vitejs/plugin-vue`；测试使用 Vitest、Vue Test Utils、jsdom、Playwright  
**Storage**: 项目内模拟数据模块；`sessionStorage` 仅保存首页滚动位置  
**Testing**: Vitest 组件/数据契约测试；Playwright 多视口交互与视觉回归测试  
**Target Platform**: 现代手机、平板和桌面浏览器；通过 HTTP 服务访问  
**Project Type**: 移动端优先的客户端路由单页 Web 前端  
**Performance Goals**: 首屏 2 秒内显示完整警示与主要入口；交互无明显延迟  
**Constraints**: 320/375/390/768/1440 像素视口无横向溢出；模拟数据模式零远程业务请求；旧详情 URL 可兼容访问；不修改范围外目录  
**Scale/Scope**: 1 个 Vue 应用入口、1 个旧地址兼容入口、2 个当前业务路由、7 个可见系统、7 类图表、2 个推荐方案、约 5,300 行现有 HTML/CSS/JS

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

- [x] 所有目标文件均位于 `/Users/leelee/Desktop/体检报告/nepstar`。
- [x] 报告前端只针对 `reportFront/report-v2`。
- [x] 使用用户已批准的 Vue 3 + JavaScript，不使用 TypeScript。
- [x] 迁移保持已确认的 V2 视觉与行为；规格没有授权重新设计。
- [x] Vite 作为 Vue 单文件组件的构建工具，不改变业务架构或引入远程服务。
- [x] 未引入不同框架、存储层或通信层。
- [x] 测试任务将遵循 Red → Green → Refactor，先建立失败的迁移验收测试。

**Gate result**: PASS，无需复杂度豁免。

### Post-Design Gate

- [x] 设计文件只描述 V2 目录内的结构和契约。
- [x] Vue Router 已获用户明确批准；Hash 路由无需静态服务器配置 history fallback。
- [x] 旧 `detail.html?id=<systemId>` 保留兼容跳转，已有入口不会直接失效。
- [x] 共享模拟数据消除首页与详情的数据重复，不接入后台 API。
- [x] 除已批准的 Vue Router 外，不使用 Pinia、Axios、UI 组件库或服务端渲染。
- [x] 测试、响应式和资源回退均能映射到规格中的可验证要求。

**Gate result**: PASS，可进入任务拆分阶段。

## Project Structure

### Documentation (this feature)

```text
specs/002-migrate-v2-vue/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── README.md
│   ├── mock-report-data.md
│   └── ui-behavior.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # 由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
reportFront/report-v2/
├── index.html               # Vue 单页应用入口
├── package.json
├── package-lock.json
├── .nvmrc                   # V2 独立 Node 版本，不影响 KH503
├── vite.config.js           # Vue 构建与测试配置
├── public/
│   ├── detail.html          # 原 URL 的静态兼容跳转页，构建时原样复制
│   ├── AI长寿咨询聊天页设计稿.png
│   ├── AI长寿咨询-卡通医生形象.png
│   ├── 睡眠健康管理方案.png
│   ├── 钙流失健康管理方案.png
│   └── 长寿指数报告V2_手机长图.png
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── router/
│   │   └── index.js
│   ├── views/
│   │   ├── ReportHome.vue
│   │   └── SystemDetail.vue
│   ├── components/
│   │   ├── ScoreOverview.vue
│   │   ├── ReportProfile.vue
│   │   ├── SystemAtlas.vue
│   │   ├── DetailChart.vue
│   │   ├── RecommendationCard.vue
│   │   ├── AiConsultEntry.vue
│   │   └── SaveReportButton.vue
│   ├── composables/
│   │   ├── useScoreAnimation.js
│   │   ├── useCardReveal.js
│   │   └── useScrollRestoration.js
│   ├── data/
│   │   └── report.js
│   ├── utils/
│   │   ├── report.js
│   │   └── chartGeometry.js
│   └── styles/
│       ├── styles.css
│       └── overrides.css
├── tests/
│   ├── unit/
│   │   ├── report-data.spec.js
│   │   ├── report-order.spec.js
│   │   └── chart-geometry.spec.js
│   ├── components/
│   │   ├── ScoreOverview.spec.js
│   │   ├── RecommendationCard.spec.js
│   │   └── SystemDetail.spec.js
│   └── e2e/
│       ├── report-home.spec.js
│       ├── system-detail.spec.js
│       ├── responsive.spec.js
│       └── visual-regression.spec.js
└── render.mjs              # 更新为面向构建后页面的长图渲染/验收脚本
```

**Structure Decision**: 使用单个 Vite SPA 和 Vue Router Hash 路由。`index.html` 是唯一 Vue 应用入口，`/#/` 与 `/#/system/:systemId` 分别承载报告首页和系统详情；`public/detail.html` 是构建时原样复制的静态兼容页，仅负责把旧 `detail.html?id=<systemId>` 地址转换为新路由，不是第二个 Vue 应用入口。Hash 模式不依赖服务器 history fallback，适合当前局域网和静态部署方式。共享组件、数据和工具函数位于 `src/`。七张系统卡结构差异较大，首轮由 `SystemAtlas.vue` 保留各自既有 DOM，不强行抽象“万能卡片”。现有图片迁入 `public/` 保持稳定可下载 URL，现有 CSS 先移动到 `src/styles/` 并保持选择器与视觉输出，再按测试保护逐步整理。

## Phase 0: Research Decisions

研究结果见 [research.md](research.md)。关键决策：

1. 使用 Vue 3 单文件组件和 Composition API 的 `<script setup>` JavaScript 写法。
2. 使用 Vue Router Hash 路由组织单页应用，并保留旧详情地址兼容跳转。
3. 不使用全局状态库；模拟数据和少量浏览状态由模块、props 与 composable 管理。
4. 先建立迁移前行为与截图基线，再按照 TDD 分块替换 DOM 脚本。
5. V2 使用独立的现代 Node 环境，不改变 KH503 所需的 Node 12 环境。

## Phase 1: Design and Contracts

### Data Design

[data-model.md](data-model.md) 定义报告、身体系统、图表、指标、直接采集数据、健康推荐和页面状态。首页与详情必须读取同一份 `report.js`，系统顺序由显式排序函数产生，不能依赖 CSS `order` 纠正业务顺序。

### Interface Contracts

- [mock-report-data.md](contracts/mock-report-data.md)：模拟报告数据字段、约束和排序规则。
- [ui-behavior.md](contracts/ui-behavior.md)：应用路由、旧地址兼容、导航、下载、AI 入口、动画与错误回退契约。

### Migration Sequence

1. **建立红灯测试**：把规格中的首页、详情、推荐、顺序、响应式和零请求要求转换为失败测试，并保存当前 V2 基线截图。
2. **初始化最小工程**：在原目录增加 Vue 3 + JavaScript、Vue Router Hash 路由、Vite 和测试配置，不生成示例页面或 TypeScript 文件。
3. **统一模拟数据**：将全局 `window.longevityModules` 转为 ES 模块，增加报告级元数据和纯函数排序/查找。
4. **迁移首页**：先还原静态结构，再迁移评分动画、卡片入场、保存反馈、滚动记录和 AI 入口。
5. **迁移详情页**：按路由参数加载共享系统数据，将七类图表拆成 Vue 渲染分支，并增加未知 ID 回退与旧 URL 跳转。
6. **迁移资源与样式**：保持现有文件内容和 URL 语义，验证产品图完整显示、减少动态效果和各验收视口。
7. **更新长图工具**：针对构建后的页面重写陈旧选择器，强制等待图片与动画终态，避免隐藏模块或底部空白。
8. **回归验收**：执行单元、组件、端到端、视觉对照和生产构建，确认没有远程业务请求及范围外改动。

## Testing Strategy

### TDD Order

1. 数据契约与系统排序测试先失败，再实现 `report.js` 和排序函数。
2. 评分、推荐和详情组件测试先失败，再实现相应组件。
3. 首页/详情端到端测试在 Vue 页面尚未完成时先失败，再逐步迁移页面。
4. 响应式和视觉对照最后作为回归门禁；任何样式整理都必须保持其通过。

### Test Responsibilities

- **Unit**: 数据字段完整性、68 分警示阈值、低分推荐排序、图表几何计算、未知 ID 回退。
- **Component**: 文案/图表数据映射、推荐条件、图片 `alt`、减少动态效果、按钮反馈。
- **E2E**: 首页路由到详情再返回、直接刷新 Hash 详情、旧详情地址兼容、滚动恢复、七个系统详情一致性、AI 静态入口、长图下载、零远程请求。
- **Visual/Responsive**: 320/375/390/768/1440 五种宽度；重点检查横向溢出、产品图裁切、隐藏卡片和底部异常空白。390 像素视口允许为固定 AI 入口保留不超过 140 CSS 像素的尾部安全区。

## Risk Controls

- **CSS 体量大**：两个样式文件约 4,700 行。第一阶段不重构命名，只保持 DOM 类名兼容；清理样式另立需求。
- **旧长图脚本选择器过期**：不把现有 `render.mjs` 视为可靠测试，先以规格重建断言。
- **长图高度不是固定值**：现有首页长图与设计基准高度不同；视觉验收结合语义、几何和有限像素差，不以整图高度或单一像素差作为唯一结论。
- **Node 版本冲突**：仓库默认 Node 12 服务于旧 RN；V2 前端使用项目级 Node 24.12+ 环境，不修改 KH503 配置。
- **动态 HTML 注入**：原详情图表通过字符串和 `innerHTML` 生成；迁移后使用 Vue 模板和计算属性，避免新增任意 HTML 注入路径。
- **视觉漂移**：每完成一个区域即进行基线截图对比，不在迁移过程中顺便重新设计。
- **未跟踪目录**：实施前确认 `reportFront/` 的 Git 纳入方式，避免迁移成果缺少版本历史。

## Complexity Tracking

无宪章违规或需要豁免的复杂度。Vue Router 已获批准并用于页面导航；Pinia、Axios、UI 组件库和服务端渲染均不在本阶段引入。
