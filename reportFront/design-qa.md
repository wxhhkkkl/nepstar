# 免疫力首页卡片检查

final result: passed

用户最终要求：保留第一版雷达图，在下方添加五项指标柱状图。按这次澄清检查，不将参考站点的另一版雷达图作为替换目标。

视觉依据：用户附图 /var/folders/k7/kgj25zk13_v17pbwsp5tzymh0000gn/T/codex-clipboard-6438aad3-8ef5-43b9-bab3-afdfb78a1ba0.png；原版雷达图为 SystemCard.vue 原有六节点 SVG 及其样式。
实现截图：/Users/leelee/Desktop/体检报告/design-refresh-2026-10-22/immune-home/implementation-original-radar-plus-bars-414.png
局部截图：/Users/leelee/Desktop/体检报告/design-refresh-2026-10-22/immune-home/immune-radar-and-bars.png

Viewport: Chrome 已有手机模拟 414 × 736 CSS px，截图 1873 × 960，包括浏览器与开发者工具；手机内容按 1:1 CSS 尺寸显示。比较以手机卡片区域为准。
State: 指定报告首页，滚动到免疫力卡片，综合分 88，子项分数 98、98、90、96、92。

检查结果：
- 雷达图：恢复原始节点位置、中心分数、线条和左右布局。
- 字体：沿用报告字体，子项名称 14px、分数 22px；名称按语义换行，不截断。
- 布局：第一版雷达图在上，新增柱状图在下；五项完整显示，没有横向溢出。
- 颜色：沿用项目评分颜色，柱高对应真实分数。
- 图像：没有新增装饰图片；保留原始图表 SVG。
- 内容：按接口指标顺序显示全部五项；综合分取接口原值。

检查历史：首版只有柱图；用户明确要求保留第一版雷达图后，恢复原图。第二次检查发现名称换行不自然，补充语义换行后再次截图，名称完整可读。

构建：Vite 生产构建通过，输出到 /tmp/nepstar-immune-build。
限制：本次视觉检查为 414px；小于 390px 配置三列换行，未完成该宽度浏览器截图。未重跑路由交互测试。
