# Implementation Plan: 单指标详情展示与只读数据边界

**Branch**: `005-single-indicator-detail` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

## Summary

扩展现有报告聚合层新增单指标详情读取，递归读取原始报告节点和历史同指标分数；在指标管理开放子指标文案编辑；在 V2 报告前端新增与确认设计一致的详情页、骨架屏和返回位置恢复。无需数据库迁移。

## Technical Context

**Language/Version**: Python 3.11+；Vue 3 + JavaScript（报告前端）；管理端沿用既有 Vue + TypeScript
**Primary Dependencies**: 既有 FastAPI、SQLAlchemy、Motor、Vue Router；不新增依赖
**Storage**: `nepstar` 现有指标配置可写；`platform`、`kj_fastplus`、MongoDB 只读
**Testing**: pytest、Vitest，全部采用 mock/fake 外部源
**Target Platform**: 移动浏览器和现有后台服务
**Performance Goals**: 指标详情 P95 ≤ 3 秒
**Constraints**: 无外部库写入/迁移；不使用演示趋势；报告前端不构建，仅运行目标测试与语法检查
**Scale/Scope**: 单指标详情、子指标文案编辑、最近六次趋势

## Constitution Check

- [x] 目标文件都在 `/Users/leelee/Desktop/体检报告/nepstar`。
- [x] 报告前端只改 `reportFront/report-v2`，不改参考设计目录或 V3。
- [x] 报告前端只用 Vue 3 + JavaScript，不加 TypeScript 或依赖。
- [x] 用户已明确要求基于既有聚合路径开发单指标接口；沿用存储/通信层，不新增服务或表。
- [x] 测试先红后绿；每项新增逻辑有可验证测试。
- [x] `platform`、`kj_fastplus`、MongoDB 绝对只读；本功能不运行数据库迁移。

## Project Structure

```text
nepstarAdmin/backend/app/{api,services,i18n}
nepstarAdmin/backend/tests/{api,unit}
nepstarAdmin/frontend/src/views/health
nepstarAdmin/frontend/src/views/health/__tests__
reportFront/report-v2/src/{api,components,views,router,composables,styles}
reportFront/report-v2/tests/{components,unit}
specs/005-single-indicator-detail
```

**Structure Decision**: 在现有服务文件和 V2 页面目录内扩展，不引入新模块边界。

## Design

1. 后端先验证报告归属和就绪，再用 `nepstar.sa_indicator` 编码查目标与父系统。只读扫描当前报告树验证真实父子关系。
2. 历史查询先从 `platform.inspect_base` 按客户、当前报告时间和状态读取候选编号，再按 MongoDB `_id` 批量读取；递归找任意层级原始指标；最多输出六个有效点。
3. 前端指标行变成稳定编码路由链接；保留路由查询中的报告/客户标识，返回时恢复系统详情此前的滚动位置。
4. 页面按已确认稿实现，不绘制虚构趋势，不显示产品/AI/“本次表现”/底部返回按钮。
5. 管理端显示子指标文案字段；一级现有必填规则保持，子指标可以留空。

## Complexity Tracking

无新增依赖、表或跨库写操作。真实历史趋势需要一个只读递归查找函数，这是本需求的最小扩展。
