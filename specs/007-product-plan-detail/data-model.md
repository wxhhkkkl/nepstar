# Data Model: 产品方案详情页

本功能只有派生读取模型与临时阅读状态，不增加数据库表、迁移或外部写入。完整字段约定见 [接口契约](contracts/report-plan-detail.md)。

## Existing Source Entities

| 实体 | 既有来源 | 使用方式 |
| --- | --- | --- |
| 报告身份/状态 | Mongo报告与旧SQL主记录 | 双方存在、客户一致、ready后才读取详情。 |
| 指标定义/报告分值 | sa_indicator及报告真实分支 | 校验启用、父系统、当前分支；保留原分数及既有颜色语义。 |
| 方案 | sa_plan、sa_plan_indicator | name、description、trigger_score_below、status、sort_order；应用既有本地overlay。 |
| 商品关联 | sa_plan_product | 仅有效方案解析出的当前商品关系，保留sort_order/id。 |
| 商品及图库 | sa_product、sa_product_image | 启用商品的名称、简介、detail_html、cover及有序图片；不暴露后台时间/状态等内部字段。 |
| AI全局状态 | 既有deployment/settings/provider配置 | 纯读，失败不影响方案正文；不含密钥、模型配置细节或用户配额。 |

## ReportPlanContext

内部轻量模型：`report_code`、`customer_id`、`plan_id`、`plan_name`、`description`、`primary_indicator`、`related_indicators`、`product_ids`。产品ID仅详情补全使用，不作为模型输入。

每个关联包含 `system_code/system_name/indicator_code/indicator_name/indicator_score/trigger_score_below`。关联来自同一报告、启用指标与有效方案，不接受浏览器传入名称/分数。匹配要求分数是0–100整数且严格小于实际阈值；空阈值沿用现有80默认，不能把0误当缺失。缺分不能形成有效推荐。

指定有效indicator_code优先；显式传入错误或不匹配代码返回不可用，不静默换项。省略时按既有系统及指标顺序选择首项；related_indicators是完整、去重、有序集合，包含primary。相同代码存在歧义、父系统或报告分支不符时不得采纳。

AI的窄投影只保留报告身份、当前选择关联及方案名称/说明/阈值；每次回答重新验证。不得加入商品HTML、图库或URL里的自定义文案。

## PlanDetail

- `report_code`：与请求报告一致，不扩散其他客户信息。
- `plan`：`plan_id/name/description`；方案本身无独立图片字段，不编造。
- `primary_indicator`及`related_indicators`：报告事实；两个查看指标动作使用同一primary。
- `products`：有序有效ProductDetail列表，允许空数组。
- `consult`：`status`为available/maintenance/unavailable；`message`为允许公开的维护说明或通用提示。

首区图取首个有效商品的首张有效图片；没有任何图片时为中性缺图状态。不得拿其他方案封面填补。使用既有本地素材时也必须匹配原商品映射。

## ProductDetail

`product_id/name/description/images/detail_blocks/detail_truncated`。名称完整换行；简介null隐藏。images为有序、合法、去重的`{url,alt}`，cover优先，图库其次；alt取维护值（如有）或真实商品名。无图保留稳定占位；单图无切换控件；多图有当前序号及可访问切换操作。

产品可以分别展开，判断依据为清洗后detail_blocks非空，而非原HTML字符串非空。空HTML、只含脚本或空标签不产生展开箭头。正文安全块为paragraph/heading/list/image，具体结构与界限见契约。

## PlanReadingSnapshot (browser only)

sessionStorage独立命名空间；opaque的planNavKey引用本地记录，不是授权凭证。每条记录包含：

| 字段 | 说明 |
| --- | --- |
| version、createdAt、updatedAt | 版本/过期检查，默认30分钟闲置过期。 |
| identity | reportCode、customerId、planId、有效indicatorCode，必须严格核对。 |
| origin | 有界命名路由home/system-detail/ai-consult、原始合法query和必要params；不得是任意URL。 |
| originReading | scrollY；来源AI额外plansExpanded。 |
| planReading | scrollY、expandedProductIds、imageIndexByProduct；仅保留仍存在的有效商品。 |
| pendingRestore | source或plan，一次性消费，首次直接打开不恢复旧位置。 |

最多20条，过期/身份不符/版本不符/损坏记录删除；storage不可用时功能可读、返回同报告首页。记录不含guest token、聊天、草稿、session ID、报告正文、商品HTML或患者资料。返回地址必须从命名路由重新构建，绝不执行存储中的URL。

## State Transitions

页面：`idle → loading → ready | report-not-found | report-not-ready | plan-not-found | unavailable`。网络/来源不可用允许显式重试；身份或route改变递增requestVersion并清空旧内容，迟到响应不得覆盖新页面。

ready内可独立出现：空商品、缺图、无说明、无可展开正文、正文截断、咨询暂停。这些不转换为整页错误。0分显示0；通用适配器遇缺分显示“未提供”，但无有效分数的旧链接不能绕过方案匹配。

产品：collapsed↔expanded；多图index在有效范围内切换。动画200–320ms，reduced-motion时即时；展开入口button有aria-expanded/aria-controls，隐藏内容不保留焦点陷阱。

AI：保持现有离开确认→结束/清理→重新激活load。阅读恢复发生于真实bootstrap后，不恢复消息/草稿/session，不发提问。AI可用状态变化不能修改方案事实。
