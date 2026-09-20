# Research: 单指标详情

## Decision 1 — 保留现有三数据源读取边界

**Decision**: 报告编号归属和日期从 `platform.inspect_base` 只读获取；指标字典若需要也只读；分数与原始异常等级从 MongoDB `receive_report.reportV2Info` 只读获取；可维护文案只使用 `nepstar.sa_indicator`。

**Rationale**: 当前服务已按该路径运行。把原始结果复制进 `nepstar` 会引入同步/回写和数据不一致风险，也违背只读红线。

**Alternatives considered**: 复制历史分数或调整旧库结构——拒绝；在 MongoDB 按客户 ID 全表扫描——集合没有该字段索引，拒绝。

## Decision 2 — 精确匹配原始三级节点

**Decision**: V2“子指标”映射的数字 `target_id` 从原始树任意层级读取；同时验证它位于登记父系统对应节点的子树中。

**Rationale**: V2 两级展示树压平了原始三级树，不能假定展示子指标就是原始二级。

**Alternatives considered**: 按中文名称查找或只检查目标节点存在——可能跨系统错配，拒绝。

## Decision 3 — 历史趋势按报告编号回查

**Decision**: 在 `platform.inspect_base` 只读查询当前客户不晚于当前报告的最近报告编号与日期，再按 MongoDB `_id` 索引只读批量取文档，递归找同一 `target_id`；最多返回六个真实点。

**Rationale**: 与现有系统趋势取数路径一致，避免按无索引的客户 ID 扫描 MongoDB。

**Alternatives considered**: 使用设计稿固定 `[78,82,85,87,90,92]`——虚构数据，拒绝。

## Decision 4 — 状态文案与建议不自动生成

**Decision**: 指标状态、解读和建议来自现有 `nepstar.sa_indicator` 字段，原始 `abLevel` 原样返回供核验，不凭得分阈值编造医学结论。

**Rationale**: 当前未确认 `abLevel` 到中文状态的完整映射；由后台人员维护文案可审计、可清空。

**Alternatives considered**: 92 分硬编码为“正常”或按固定阈值生成建议——缺乏已确认业务口径，拒绝。

## Decision 5 — 页面沿用 V2，不接入附加商业/AI 模块

**Decision**: 新页面保留顶部返回、得分卡、解读、趋势、行动建议、免责声明和骨架屏。按最后确认稿去掉本次表现、底部大按钮、产品推荐、AI 入口。

**Rationale**: 用户已逐轮确认视觉范围；现有系统详情的商业推荐不受影响。

**Alternatives considered**: 照搬旧 `third.html` 全部栏目——与已确认设计不一致，拒绝。

## Security boundary

- 新功能代码对 `platform`、`kj_fastplus` 和 MongoDB 仅发起读取请求；不运行迁移、DDL、DML、回填或自动修复。
- 只有现有后台指标维护流程能写 `nepstar.sa_indicator`。数据库账号的物理只读授权由部署方设置；代码不声明也不尝试修改其他库授权。
- 测试使用 mock/fake 数据源，不连接生产实例。
