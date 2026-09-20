# Tasks: 单指标详情展示与只读数据边界

**Input**: [spec.md](spec.md), [plan.md](plan.md), [contracts/indicator-detail.md](contracts/indicator-detail.md)
**Prerequisite**: 全部外部源只读；测试使用 mock/fake，绝不触碰真实数据源写路径。

## Phase 1: Setup and safety

- [x] T001 核对目标目录、现有数据源权限边界与设计范围：`nepstarAdmin/backend`、`nepstarAdmin/frontend`、`reportFront/report-v2`。
- [x] T002 完成规格、研究、接口契约及宪法检查：`specs/005-single-indicator-detail/`。

## Phase 2: Foundational

- [ ] T003 在 `nepstarAdmin/backend/tests/unit/test_report_source.py` 先写任意层级节点和只读历史趋势测试并确认失败。
- [ ] T004 在 `nepstarAdmin/backend/app/services/report_source.py` 实现真实节点定位及最近六次趋势只读查询。

## Phase 3: User Story 1 — 指标详情与导航 (P1)

**Independent Test**: 指标详情与同报告系统详情分数一致；错误指标不回退；返回系统详情原位置。

- [ ] T005 [US1] 在 `nepstarAdmin/backend/tests/unit/test_report_view_service.py` 与 `tests/api/test_report_view.py` 先写详情和错误契约测试并确认失败。
- [ ] T006 [US1] 在 `nepstarAdmin/backend/app/services/report_view_service.py`、`app/api/report_view.py`、`app/i18n/__init__.py` 实现受保护的详情聚合与接口。
- [ ] T007 [US1] 在 `reportFront/report-v2/tests/components/IndicatorDetail.spec.js` 先写导航、数据一致性和错误态测试并确认失败。
- [ ] T008 [US1] 在 `reportFront/report-v2/src/api/reportClient.js`、`src/router/index.js`、`src/views/SystemDetail.vue` 和新详情页实现带报告上下文的指标导航。
- [ ] T009 [US1] 在 `reportFront/report-v2/src/composables/useScrollRestoration.js` 与对应测试中实现系统详情位置恢复。

## Phase 4: User Story 2 — 趋势、建议与骨架屏 (P1)

**Independent Test**: 多次记录使用真实点；首次记录不画假线；建议为空时隐藏；加载时显示骨架屏。

- [ ] T010 [US2] 在 `reportFront/report-v2/tests/components/IndicatorDetail.spec.js` 添加先失败的趋势、空值及骨架屏测试。
- [ ] T011 [US2] 在 `reportFront/report-v2/src/views/IndicatorDetail.vue`、`src/components/IndicatorDetailSkeleton.vue`、`src/styles/overrides.css` 实现已确认高保真布局和状态。

## Phase 5: User Story 3 — 子指标文案与只读红线 (P1)

**Independent Test**: 子指标文案可编辑、可清空；新增读取链路不包含外部数据源写语句。

- [ ] T012 [US3] 在 `nepstarAdmin/frontend/src/views/health/__tests__/IndicatorList.spec.ts` 先写子指标文案显示、保存及空值测试并确认失败。
- [ ] T013 [US3] 在 `nepstarAdmin/frontend/src/views/health/IndicatorList.vue` 放开子指标文案编辑，保留一级既有校验。
- [ ] T014 [US3] 在 `nepstarAdmin/backend/tests/unit/test_report_source.py` 校验外部源调用仅为 SELECT/find，审查全部新增服务代码无非 `nepstar` 写路径。

## Phase 6: Validation

- [ ] T015 运行后台 pytest、管理端 Vitest、报告端 Vitest，以及代码语法/静态检查；不执行生产数据库迁移或前端构建。
- [ ] T016 核对 `git diff`、安全边界和本任务范围，并更新 `specs/005-single-indicator-detail/tasks.md` 完成标记。

## Dependencies

T003 → T004 → T005 → T006；T007 → T008 → T009；T010 → T011；T012 → T013；T014、T015、T016 在对应实现后执行。所有实现先红后绿。

## Implementation strategy

先打通后端契约与真实趋势，再接前端页面和管理文案，最后做跨层回归。各测试只用本地 mock/fake，不连接生产数据库。
