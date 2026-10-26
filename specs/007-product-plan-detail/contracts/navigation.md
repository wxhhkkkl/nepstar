# Contract: Plan Navigation and Reading State

## Stable Route

`/#/plans/:planId?reportId={report}&userId={customer}&indicatorCode={code}&planNavKey={opaque}`，route name为`plan-detail`。

planId为正整数；报告身份沿用reportParamsFromLocation及reportRouteQueryFromLocation，兼容当前reportCode/customerId别名并统一为reportId/userId；indicatorCode可省略，由后端选有效首项并作为页面后续目标。planNavKey可省略，不参与授权及接口查询。API使用snake_case，路由继续既有camelCase。

保留当前合法启动/渠道参数，沿用现有helper对guest_token等敏感参数的剔除。构造新方案路由时移除旧fromAiConsult/fromPlan/returnSystem/planId等内部返回上下文，避免被当成新的来源；原来源query单独保存在受控快照，不被当前选中方案覆盖。

## Three Entry Points

| 来源 | 行为 |
| --- | --- |
| 首页RecommendationCard | action文案“查看方案”；保存首页当前位置和身份；携带该recommendation的plan_id与trigger_indicator_code。 |
| 系统详情RecommendationCard | 同文案与定位；保存实际systemId、报告身份及位置。 |
| AI matched plan列表 | 同文案与定位；保存AI原有入口query、plansExpanded及scrollY；正常触发既有离开守卫。 |

只在有效点击并确认离开后提交可消费的快照。AI取消离开时不得误留恢复标记或跳转。来源ID/分数只定位，不作为服务端事实。三个入口统一调用planNavigation helper，不能各自拼出不同参数。

## Return Snapshot Rules

来源恢复用临时planSourceKey引用快照，保留原AI入口自身的planNavKey与planId，防止覆盖它返回上一方案的上下文。浏览器返回没有该参数时按同报告/客户/来源查找待消费记录。

快照按 [data-model.md](../data-model.md) 限制为30分钟、最多20条、同报告/客户/方案/指标、版本有效。只存命名路由及合法params/query，不执行任意returnTo/URL；拒绝跨报告、更改身份或损坏记录。来源只接受home/system-detail/ai-consult，不把新页面历史堆栈序列化进记录。

顶部返回先解析本地受控来源。已确认前一个历史条目就是预期目标时可back，否则replace受控目标，避免外站历史和重复回环；无记录或新窗口降级同报告首页。方案API读取不依赖快照，刷新或分享仍可独立打开。缓存过期最多失去阅读位置，不使正文不可读。

从AI列表进入时保存原AI查询上下文，不能用详情的新planId覆盖它。若原AI本身带其他阅读返回引用，只允许同身份、仍有效且无循环的既有planNavKey引用；不复制嵌套快照，检测自引用或循环时降级同报告首页。快照容量及过期限制同样适用，不能无限串联。

## Plan → Indicator → Plan

关联区“查看指标”及底部“查看关联指标”共用同一computed route：

- name=`indicator-detail`，params为primary的system_code和indicator_code，沿用当前适配的systemId格式。
- query保留同一reportId/userId，并附`fromPlan=1`、`planId`、`indicatorCode`、`planNavKey`。
- 离开前保存方案scrollY、有效展开商品和图片index；不覆盖originReading。
- IndicatorDetail的parentRoute优先处理合法fromPlan，之后才沿用原AI/系统逻辑；移除child标记，重建plan-detail。
- 方案重读并核对身份后恢复仍存在的商品状态，nextTick及双rAF再恢复scrollY；源数据停用/改变时显示真实结果，不把本地快照当内容缓存。

其他related_indicators各自可进入其真实指标，不修改默认primary。返回时仍回原方案及原primary；不把刚查看的其他指标悄悄变为主关联。

## Plan → AI → Plan

咨询按钮进入现有`ai-consult`：同reportId/userId、有效planId/indicatorCode、fromPlan=1及planNavKey。来源类型为plan，沿用现有consent、bootstrap及会话规则；按钮点击不提交问题、不生成turn或调用模型。

AI backTo优先识别合法fromPlan，返回该方案；之后才处理既有returnSystem等分支。AI返回操作仍经过既有confirmPageLeave，取消时保留当前会话/草稿并停留；确认后按原规则结束及清理。

全局consult.status非available时按钮disabled并给出维护/暂不可用说明；仍显示并可阅读方案。进入AI后最终身份、同意、配额或状态检查可能再次失败，复用既有提示，不将全局available解释为提交保证。

## AI List Origin Restoration

保持App的KeepAlive include=AiConsult。离开时现有onDeactivated结束会话，下一次onActivated仍正常load。需要在新bootstrap真实数据就绪后恢复先前plansExpanded，再nextTick、双rAF恢复scrollY。

仅恢复列表及阅读位置：禁止恢复消息、草稿、旧session、旧guest凭证或历史聊天；禁止跳过确认或自动发送。若匹配列表变化，仅恢复当前仍有效的列表内容，位置按当前页面高度夹取。方案→AI后再次返回原AI列表时仍使用最初origin，而非新方案的入口上下文。

## Scroll, Races and Motion

router.scrollBehavior对方案相关返回由真实内容就绪后的恢复函数负责，避免savedPosition在骨架上抢先执行。原首页/系统恢复继续工作，不改成全应用自动缓存。首次打开或显式刷新未请求恢复时从顶部开始；浏览器返回和页面返回都应消费相应恢复标记。

PlanDetail复用IndicatorDetail的requestVersion与响应身份检查。切换报告/方案/指标后先清旧内容，旧请求迟到不可覆盖；缺参数不请求默认报告。存储不可用时优雅降级。

产品展开、收起及图片反馈200–320ms；prefers-reduced-motion时近乎即时。主要点击区域≥44px，展开button有aria-expanded/controls，图片切换有可读序号。顶部保持易触达，底部固定dock与safe-area预留实际高度，不能遮住正文或免责声明。
