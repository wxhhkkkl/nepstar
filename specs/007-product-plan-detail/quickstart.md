# Quickstart and Validation: 产品方案详情页

工程实施已完成，实际结果见[validation.md](validation.md)。下列命令为复核指引；后端必须使用隔离元数据与连接保护，不能直接导入默认外部数据库conftest。真机和五人评审仍待人工。

## Preconditions

1. 在仓库根目录核对branch=`008-product-plan-detail`、feature.json=`specs/007-product-plan-detail`；编号不同是两个计数来源，不重命名。
2. 阅读spec.md、selected-design.md、design-03.png、plan.md及contracts。目标是当前reportFront，不是旧版/V3/KH503。
3. 保持已配置的数据库隔离及隧道，不修改远端配置、不迁移、不改阈值制造样例。故障先用Mock验证，真实读取只在现有授权边界内进行。
4. 使用项目已有依赖，不新增安装项。前端Node需满足package.json engines；后端Python≥3.11，使用既有backend虚拟环境。不要切换旧KH503的运行环境。
5. [tasks.md](tasks.md) 已生成，已通过一致性修正并按宪法TDD实施。每批测试先确认Red，记录失败原因，再最小实现Green；不将已有通过测试冒充Red。

## Planned Verification Commands

以下为复核命令，执行时须保持隔离约束。命令分别在对应工作目录运行，不在需要数据库的默认测试设置下盲目跑全库。

前端 `reportFront/`：

```sh
npm test -- tests/components/PlanDetail.spec.js
npm test -- tests/unit/plan-navigation.spec.js
npm test -- tests/unit/system-scroll-restoration.spec.js
npm run build
```

前两个为tasks.md计划新增测试。随后运行受影响的RecommendationCard、router、IndicatorDetail及AiConsultLifecycle等组件/客户端测试；具体新增测试路径见任务清单。只有新改动或失败才扩大重复测试范围。

后端 `nepstarAdmin/backend/`，使用现有venv的Python：

```sh
.venv/bin/python scripts/test_report_plan.py
```

该项目脚本提供inspect_base内存元数据，关闭父conftest，拒绝所有SQL连接和socket网络连接，默认执行本功能148项相关回归。可传具体测试文件与pytest选项覆盖选择，例如：

```sh
.venv/bin/python scripts/test_report_plan.py tests/unit/test_product_content.py
```

新增正文/详情测试及AI sources/evidence测试应使用FakeDB/AsyncMock，覆写连接依赖，不连外部库、不创建真实guest/会话、不发模型请求。API可建立独立FastAPI测试app挂载router，避免导入main时触发旧库反射。严格断言读取边界，不用SQL写入制造数据。

浏览器验收使用已批准的项目工作流及可用浏览器工具，不能绕过当前环境的浏览器自动化规则。现有e2e测试可新增回归用例，但手工页面检查与性能测量需单独记录证据。

## Fixture Matrix

| 场景 | 验收要点 |
| --- | --- |
| 睡眠方案：98<99 | 正确匹配、高分沿用优秀颜色；不写异常结论；使用真实对应素材。 |
| 等于阈值/高于阈值 | 不命中；显式旧链接plan_not_found。 |
| 0分/缺分 | 0参与严格比较且显示0；缺分不生成有效关联，不补0。 |
| 多有效关联，非首页当前卡 | 点击项优先；省略按报告顺序；错误点击代码不回退；AI入口及每次取证支持完整有效集合。 |
| 外客户/未ready/分支不符 | 与既有错误契约一致；无报告信息泄漏。 |
| overlay停用/解绑/改阈值/改商品 | 与现有推荐源一致，不裸查远端绕过。 |
| 0/1/多商品 | 有序独立内容；停用商品排除；无商品仍能读方案。 |
| 无正文/空标签/仅脚本 | 无展开箭头和空容器；仍保留名称/简介/图。 |
| 真实段落/列表/多图/长标题 | 安全结构块、独立展开、完整换行、图片按原比；单图无无意义控件。 |
| 恶意/畸形/过深/超长HTML | 无脚本执行、事件属性、危险URL或原HTML兜底；有界处理及真实截断提示。 |
| 空图/坏图 | 稳定占位，不套用其他商品图。 |
| AI维护/配置读取故障 | 正文成功、咨询禁用且提示；无guest/session/turn或provider调用。 |
| 方案在会话后停用 | 下一次AI取证仍重验、沿用plan_stale降级，无模型调用。 |
| 网络超时/快切身份 | 重试提示；旧响应不覆盖；无假数据或串报告。 |

## Navigation Acceptance

分别测试首页、系统、AI三来源：进入指定详情→查看指标→回方案原位置→回来源原位置。两个查看指标入口必须完全相同；其他关联项使用各自真实指标。

测试方案→AI→方案，再返回原来源。AI有草稿/消息时可取消离开；确认后旧会话结束，返回重新load，仅恢复匹配列表展开和scrollY。消息、草稿、session均不恢复，Network中无自动turn/模型请求。原AI入口上下文不得被当前方案覆盖。

覆盖深链刷新、新窗口无快照、snapshot过期/损坏/身份不符、sessionStorage不可用、系统返回及浏览器返回；都不能跳到别的报告或任意URL。导航首次打开从顶开始，恢复必须在真实数据及展开状态就绪后。

## Visual and Accessibility Acceptance

对照第三张而非其他候选图，在320/375/390/414px宽、667–896px高记录截图。检查hero完整图、完整标题、浅蓝关联、自然段说明、产品行及底部双按钮。正文15–16px、辅助≥13px、边距18–20px，保持留白，短屏允许滚动。

检查44px点击区、键盘展开、aria状态、图片序号、reduced-motion、底部safe-area与软键盘，无横向溢出、字号压缩或正文被dock遮住。免责声明居中，沿用现有日常健康参考措辞。

SC-002需记录5名代表性查看者中至少4人在10秒内定位名称/关联指标/产品；无法组织时明确“未完成评审”，不宣称通过。SC-007在正常网络和既有只读环境记录样本量、数据规模、时间范围及p95；等待始终有骨架，单次测量不能代表95%。SC-008通过Mock调用断言/只读保护及Network记录证明外部写入与自动模型调用为0。

## Completion Evidence

保存Red/Green摘要、受影响回归和build结果、三入口及嵌套返回证据、四种宽度截图、只读/零自动调用断言。检查git diff范围，不混入数据、连接凭证、外部配置或生成构建产物。发布和模型实测不属于本功能规划的自动后续动作。
