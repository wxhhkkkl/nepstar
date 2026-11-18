# 首页优先关注区 Design QA

Date: 2026-11-17

## Comparison target and evidence

- Source visual truth: `/Users/leelee/.codex/generated_images/01a15372-8b35-78a1-86d4-6ec9598d9dda/exec-3b5eb6f9-11ef-41fc-8229-16609850b509.png` (first design, 1247×1261px).
- Follow-up screenshot from the user: `/var/folders/k7/kgj25zk13_v17pbwsp5tzymh0000gn/T/codex-clipboard-78988131-e993-409c-8290-a2d9a344a9ea.png` (426×370px; shows the two existing rows).
- Latest spacing/numbering reference: `/var/folders/k7/kgj25zk13_v17pbwsp5tzymh0000gn/T/codex-clipboard-ac5ca8bd-752b-44fd-ac15-3165fedd83a9.png` (412×505px; three rows, with top/bottom spacing marked on the first plan card).
- Latest number placement/compactness reference: `/var/folders/k7/kgj25zk13_v17pbwsp5tzymh0000gn/T/codex-clipboard-f2f1e6d7-a97d-4d94-b274-ef14d4a41aef.png` (621×468px; arrow points to the left gutter for sequence numbers).
- Source CSS size and density normalization: unavailable; the source is a generated design image and was not normalized.
- Implementation: `src/components/PriorityPlans.vue`, report home route `http://127.0.0.1:5176/#/?reportId=KH503LS0005865V220721182530852&userId=11922495`.
- Implementation screenshot path: unavailable. The browser route returned “REPORT NOT FOUND”, so the priority section did not render and a valid screenshot could not be captured.
- Implementation viewport and pixel dimensions: unavailable because no valid page capture was produced.
- State: intended report with two matched priority recommendations, 性腺分泌 95 and 骨质疏松 93, plus a development-only third demo row, 骨密度 90. The demo row targets the second row's bone indicator detail; its visible “模拟” badge was removed per the latest request. The local API did not provide a valid rendered report during preview.

## Findings

- [BLOCKED] Visual comparison could not be completed. The local report route returned “REPORT NOT FOUND”, leaving no rendered priority section to compare. Typography, spacing, color, product-image fidelity, and report-specific copy remain unverified in the browser.
  - Fix: make a valid local report available, then capture the same report state and viewport for full-view and focused comparison.
- Production build passed with Vite; `git diff --check` passed. These checks confirm compilation and patch formatting only; they do not replace visual QA.

## Comparison history

- First design selected: one grouped list pairs each priority indicator and score with its matched management plan. The implementation follows this structure and restores the subtitle/count and larger plan thumbnails.
- Follow-up: product covers render in their original 2:3 aspect ratio; a third dev-only mock item routes to the second row's bone indicator detail. Sequence numbers 01–03 use 14px type and sit beside the product cards, vertically centered against them. Smaller covers and tighter spacing reduce overall card height. No mock badge is shown.
- Post-change browser evidence is blocked by the missing local report; no visual pass is claimed.

## Required fidelity surfaces

- Typography: not verified against a rendered page.
- Spacing and layout rhythm: not verified against a rendered page.
- Colors and visual tokens: implementation uses the report app's existing tokens; visual comparison remains blocked.
- Image quality and asset fidelity: component uses the existing management-plan images in a 2:3 frame; the new rendered crop and scale remain unverified.
- Copy and content: the selected design's heading, count, indicator scores, plan titles, and note are represented in the component; actual report data remains unavailable in preview.

## Implementation checklist

- [ ] Load a valid report through the local API.
- [ ] Capture the mobile report view and focused priority-plan region.
- [ ] Compare against the source image, fix any P0/P1/P2 differences, and repeat the capture.

---

## Historical QA: 免疫力首页卡片检查 (2026-10-26)

Historical final result: passed

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

final result: blocked
