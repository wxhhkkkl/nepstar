# Research: 产品方案详情页

**Date**: 2026-10-26 | **Method**: 仓库只读研究，无数据库、网络或模型请求。

## 1. 页面与接口

**Decision**：当前Vue应用新增 `/plans/:planId`，在既有公开 `report-view` router扩展报告绑定详情GET。

**Rationale**：`src/router/index.js`、`src/api/reportClient.js`、`app/api/report_view.py` 已支持报告读取及业务错误；本机隔离runtime也已挂载该router。不使用管理权限接口。

**Alternatives considered**：管理 `/plans/{id}`/`products/{id}` 缺少报告绑定校验；继续跳系统页缺少方案阅读空间；新建服务增加架构改动，均不采用。

## 2. 完整有效关联与overlay

**Decision**：复用 `report_view_service._load_document_and_meta`、`_load_registry`、`report_plan_source.fetch_plans_for_indicators`；仅从报告真实分支中筛选完整有效方案。指定指标必须匹配，省略时按既有系统/指标顺序选首项。

**Rationale**：已有归属/ready、启用、关系、排序及本地overlay。overlay可覆盖停用、阈值、指标和商品关系，不能被裸查远端SAPlan替代。严格使用真实得分 `< trigger_score_below`；0有效、缺分不命中，98<99合法且不意味着异常。

**Alternatives considered**：首页每个系统只展示一个recommendation，不是完整有效集合；AI当前stale-plan→indicator降级也不能充当详情鉴权。不新增通用匹配框架，在既有report service中提供窄的方案context读取，详情及必要AI调用复用。

## 3. 商品补全

**Decision**：仅对上述结果的有效product_ids批量读取启用商品简介、detail_html和按sort_order/id排序的图库；保留方案商品顺序。cover优先，随后图库稳定去重，无cover用第一张有效图库；无图用中性占位。

**Rationale**：当前推荐只有ID、名称、封面。管理product_service不适合公开字段/状态过滤，重查远端关系会绕过overlay。批量读取避免N+1。

**Alternatives considered**：逐项调用管理API、给所有商品套睡眠礼盒图、按图片瓶子拆商品均不采用。既有本地图只用于原有的对应真实商品映射。

## 4. 安全正文

**Decision**：标准库HTMLParser转换为有限段落、标题、列表和图片块；Vue插值和受控图片组件展示，禁止v-html。忽略样式及布局属性，丢弃主动内容子树，验证图片URL并限制大小/深度。

**Rationale**：后端及前端均无现成sanitizer，维护内容目前保留原HTML。有限结构块无需新增依赖，并能保留正常文字、列表及图片。

**Alternatives considered**：原HTML透传、正则黑名单、v-html均不采用；新库改变依赖，当前无需；纯文本会丢失真实列表/图片，也不采用。超界提供真实截断提示，细则见接口契约。

## 5. AI全局状态

**Decision**：在既有ai_consult_control内组合deployment gates、维护配置、enabled和provider_matches_configuration，纯读取公开入口状态。状态失败只禁用咨询，不阻断正文；不创建guest/consent/session，不发模型探针。

**Rationale**：当前bootstrap需要guest token，且混有用户处理许可和配额；不能为读详情调用它。全局available仅指入口开放，用户同意/身份/配额留给AI页最终检查。

**Alternatives considered**：硬编码可用、打开详情即创建guest、导入API模块复用bootstrap均不采用。复用现有control/provider helper，不增加独立服务。

## 6. AI完整方案上下文及回答取证

**Decision**：详情、AI bootstrap/create-session以及每次回答取证复用严格、轻量的方案context helper；只返回真实名称/说明、系统/指标/分数/阈值，不读图库/商品正文。AI通过既有ReadOnlyReportSession及显式窄适配器读取。

**Rationale**：`ai_consult_plan_context.resolve_entry_context`和`ai_consult_evidence`目前只认首页单张recommendation；pipeline遇plan_stale会降级，单改入口不足。`ai_consult_sources`只允许home/indicator，需要显式增加plan_context白名单分支。无需改变展示用management_plans列表。

**Alternatives considered**：仅改bootstrap会导致后续取证误降级；相信URL或会话创建时快照会绕过停用/解绑。每次回答继续重验真实系统/指标、catalog/detail/context分数一致及严格阈值；过期方案保留现有降级且不调用模型。商品正文和URL文案不进入模型输入。

## 7. 阅读返回与AI生命周期

**Decision**：稳定定位放路由，本地有界快照仅存阅读状态。沿用真实内容就绪后nextTick及双rAF恢复；新增方案→指标/AI→方案→原来源链。保持App仅KeepAlive AiConsult。

**Rationale**：AiConsult现有离开守卫可确认/取消，onDeactivated结束会话，下次onActivated重新load并清空聊天及展开状态。因此需要在正常load后单独恢复plansExpanded和scrollY；不能仅调用rememberChatPosition。

**Alternatives considered**：跳过守卫、缓存聊天、任意returnUrl、无条件router.back、骨架上抢先恢复均不采用。旧fromAiConsult不能代表新方案来源。

## 8. 第三张及验收

**Decision**：390px基准、正文15–16px、辅助≥13px、边距18–20px、主要节奏约24px并允许24–32px留白；保留关联快捷入口与底部双按钮，两个指标入口同目标。

**Rationale**：第三张已确认，用户明确要求宽松。较矮设备自然滚动，不强行塞满首屏。

**Alternatives considered**：改另两张、增加购物信息、按生成图编产品成分均不采用。图决定布局，维护记录决定事实。

## Resolved Questions

数据入口、overlay、产品正文、AI状态和证据链、返回与实际目录均已解决。无待澄清项。外部性能及五人评审尚未实测，不在规划阶段宣称达标。
