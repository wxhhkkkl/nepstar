# Implementation Plan: 产品方案详情页

**Branch**: `008-product-plan-detail` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: `specs/007-product-plan-detail/spec.md`；用户选定的 [第三张设计稿](assets/design-03.png)。

**Stage**: 工程已实现，[任务与待验项](tasks.md)及[验证记录](validation.md)已更新；未发布。

## Summary

在当前 `reportFront/` Vue 3 应用新增独立方案详情页。首页、系统详情和 AI 匹配方案三处“查看方案”进入该页，读取本次报告的真实指标、方案说明及有效商品。布局遵循 [selected-design.md](selected-design.md)：舒展首区、浅蓝关联区、自然段介绍、产品说明和底部双按钮。

扩展既有 `report-view` 只读链路，复用报告归属/就绪校验、方案有效匹配及本地 overlay。商品 HTML 转为有限结构块后安全展示。导航恢复阅读位置；AI 校验同步支持完整有效方案，保留现有会话生命周期，不自动提问。不新增服务、数据库表、依赖或管理编辑页。

## Technical Context

**Language/Version**: JavaScript、Vue 3.5；Node `^22.18.0 || >=24.12.0`；Python ≥3.11。

**Primary Dependencies**: 现有 Vue Router 4、Vite、FastAPI、SQLAlchemy asyncio、Motor；正文解析使用标准库 `html.parser`。

**Storage**: 沿用 Mongo 报告、旧 SQL 归属及既有方案/商品配置的只读访问；遵守隔离 runtime 路由和只读保护；sessionStorage 只存有限阅读状态，不存正文、token 或聊天；无迁移。

**Testing**: 既有 pytest/pytest-asyncio、Vitest 及浏览器验收；实施按 Red→Green→Refactor；本轮只验证规划文档。

**Target Platform**: 移动浏览器及现有 WebView，320/375/390/414px，667–896px 常见高度；桌面沿用报告内容宽度。

**Project Type**: 既有 Vue 单页报告应用及 FastAPI 功能扩展。

**Performance Goals**: 正常网络详情正文或明确结果 p95≤3s；立即出现骨架；商品批量读取，避免 N+1；动画200–320ms。

**Constraints**: 外部数据零写入、零自动模型调用；不引入 TS、框架/依赖或 `v-html`；不把方案匹配解释为疾病风险；沿用现有请求超时。

**Scale/Scope**: 一个详情页、三个方案入口、一个只读详情接口及必要指标/AI 衔接；覆盖0/1/多商品、多有效指标；不改商城、管理编辑、旧版/V3/KH503。

## Constitution Check

依据 `.specify/memory/constitution.md` v1.2.1，在研究前及设计后均复核：

| Gate | 研究前 | 设计后 |
| --- | --- | --- |
| I. TDD | 通过，列入实施前置条件 | 行为失败测试先于实现；文档阶段不声明代码测试已通过。 |
| II. Scope | 通过 | 改动追溯FR-001–017；无购买、后台改版、部署或额外重构。 |
| III. Architecture | 通过 | 用户已于2026-10-26批准报告只读GET和AI窄context读取扩展；无新增服务、表或依赖。 |
| IV. Clarification | 通过 | 第三张已确认；工程未知项已通过代码研究解决，无待定产品问题。 |
| V. Canonical root | 通过 | 全部文件在nepstar内；目标为当前reportFront/src与tests。 |
| V. Vue + JavaScript | 通过 | 保持既有Vue 3 + JS。 |
| Phase order | 通过 | 本轮Plan，随后Tasks再Implement，无跳阶段。 |

**基线说明**：用户于2026-10-26批准将宪法维护目录同步为当前reportFront/（src及tests），宪法已更新为1.2.1，模板同步。

## Project Structure

### Documentation (this feature)

```text
specs/007-product-plan-detail/
├── spec.md / design-brief.md / selected-design.md
├── ui-options.json / assets/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── validation.md
├── contracts/report-plan-detail.md
├── contracts/navigation.md
└── checklists/requirements.md
```

`tasks.md` 已由 `/speckit.tasks` 生成，工程38项完成，2项人工待验。

### Source Code (repository root; proposed implementation targets)

```text
reportFront/
├── src/views/{ReportHome,SystemDetail,IndicatorDetail,AiConsult}.vue
├── src/views/PlanDetail.vue                       # 新增
├── src/components/RecommendationCard.vue
├── src/components/ReportErrorState.vue             # 必要的方案错误文案
├── src/components/PlanProductDetails.vue          # 新增，局部产品阅读组件
├── src/api/reportClient.js
├── src/data/reportAdapter.js
├── src/router/index.js
├── src/composables/useScrollRestoration.js
├── src/utils/planNavigation.js                    # 新增
├── src/assets/                                   # 复用真实商品素材
└── tests/{unit,components,e2e}/
nepstarAdmin/backend/
├── app/api/{report_view,ai_consult}.py
├── app/schemas/report_view.py
├── app/services/{report_view_service,report_plan_source}.py
├── app/services/{ai_consult_control,ai_consult_plan_context}.py
├── app/services/{ai_consult_sources,ai_consult_evidence}.py
├── app/services/product_content.py                # 新增，有限正文解析函数
├── scripts/test_report_plan.py                    # 可复现、禁止网络的测试入口
└── tests/{unit,api}/
CLAUDE.md                                         # 只更新当前计划引用
```

**Structure Decision**: 沿用router验参、report service组合校验、source批量读取的分层。前端独立view和局部产品组件，不新增通用内容框架。AI仅调整现有受限读取适配器及方案上下文/证据验证，不扩大模型输入范围。Tasks阶段核对具体测试及文件位置。

## Phase 0 — Research Outcome

见 [research.md](research.md)：完整有效方案集合及overlay不能被首页单张recommendation替代；商品批量补全；原HTML不传给浏览器；AI入口全局状态纯读取；阅读状态不等于聊天状态。

## Phase 1 — Design and Contracts

- [data-model.md](data-model.md)：派生实体、有效关联、正文及页面状态，无新增表。
- [report-plan-detail.md](contracts/report-plan-detail.md)：接口、字段、错误、安全正文和AI边界。
- [navigation.md](contracts/navigation.md)：来源、刷新、多层返回、滚动及会话规则。
- [quickstart.md](quickstart.md)：实施前置条件、测试顺序、样例与视觉验收。

| 需求 | 实施边界 | 主要验证 |
| --- | --- | --- |
| FR-001、FR-004、FR-005、FR-017 | report service/source | 归属、ready、启用/解绑、overlay、严格阈值、零写入。 |
| FR-002、FR-003 | 三入口和导航 | 一次进入、深链、嵌套返回、跨报告隔离。 |
| FR-006、FR-007、FR-008、FR-009 | 商品源/正文/组件 | 0/1/多商品、排序、空详情、恶意HTML、缺图/多图。 |
| FR-010 | AI control/context/sources/evidence | 两个指标入口同目标、暂停、完整有效方案、零自动提问。 |
| FR-011、FR-012、FR-013 | 第三张布局 | 字号/留白、完整名称、44px、底部安全区。 |
| FR-014、FR-015、FR-016 | 交互及状态 | reduced-motion、重试、空状态、免责声明。 |

实施顺序：只读契约及解析Red测试 → 最小后端 → 导航与状态Red测试 → 第三张布局/交互 → AI回归与视觉验收。任务拆分由下一阶段生成。五人可用性评审与正常网络p95必须实测记录，不能用单次截图代替。

## Complexity Tracking

无新增复杂性豁免。旧宪法路径与现行目录差异已明确记录；不新增依赖、迁移或跨应用重构。

## Planning Tooling

本机无 `pwsh`，未执行PowerShell setup脚本；已等价读取feature.json、核对spec及分支、复制填写模板并更新CLAUDE引用，无工具安装或环境变更。分支008与规格目录007各自独立，以 `.specify/feature.json` 为准。可选git提交钩子未执行，本轮不自动提交。
