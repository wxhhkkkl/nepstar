# 产品方案详情页 Design QA

Date: 2026-10-26

## Comparison target and evidence

- Visual truth: `specs/007-product-plan-detail/assets/design-03.png` (selected option 3), 853×1844px.
- Implementation: real report-bound plan 38 in the existing report application. Actual maintained name, association 性腺分泌98 and enabled product; no synthetic runtime data.
- Final content capture: `specs/007-product-plan-detail/assets/validation/plan-design-comparison-final.png`.
- Final full-view comparison: `specs/007-product-plan-detail/assets/validation/comparison-final.png`.
- Focused comparison: `specs/007-product-plan-detail/assets/validation/comparison-focused.png`, association and bottom actions.
- CSS content viewport 390×844, DPR 1. Desktop browser viewport 405×844 reserves its 15px scrollbar; clip is 390×844, no browser chrome. Reference is downsampled from853×1844 to390×844. Four responsive screenshots separately use total browser widths320/375/390/414; screenshot transport may downsample these to375px and their dimensions are not mistaken for CSS geometry.
- State: initial ready plan, products collapsed; actual product has no maintained detail body, so no disclosure arrow. Source reference paragraph is illustrative; the real maintained product description is longer and may move the product-information note below the first viewport. Natural scrolling is intentional under FR-012.

## Findings and comparison history

1. Initial P2: product hero appeared too small and header/association spacing accumulated below the intended rhythm. Initial comparison: `assets/validation/comparison-initial.png` in the feature directory. Fixed by scaling the existing real product image within its slot and aligning header/association padding.
2. Subsequent P2: at the same390px content width the title broke inside“管理方案”. Fixed hero grid to1.3:1 and limited the title to7.5em while retaining26px text. Header80px and hero minimum176px put association top at256px, matching the selected target's main composition.
3. Post-fix evidence is the final full-view and focused comparison above. No remaining actionable P0/P1/P2 visual finding. P3: slight raster/text antialiasing differences from the generated reference; no new fonts or assets were substituted for maintained product facts.
4. Functional issue found during QA: AI→another plan→browser Back lost the expanded plan list when the original AI entry itself came from an older plan. Added a failing component regression, distinguished current child navigation from the original AI origin, and re-tested in the browser: aria-expanded=true, two visible plans, original plan38 context retained.

## Required fidelity surfaces

- Typography: existing PingFang SC/Microsoft YaHei stack, title26px (24px narrow), sections20px, body16px, helper13px; full names wrap. Native keyboard focus is visibly outlined; Enter on the system's plan link opens the page, Tab from Back focuses“查看指标”.
- Spacing/layout:18–20px normal gutters,24–32px section rhythm, light divider and product row. Sticky header stays at0 after scrolling. ResizeObserver reserves actual dock height plus24px, so longer notes and maintenance state cannot permanently cover content.
- Colors/tokens: pale blue/white/navy and blue primary CTA; actual98 uses the existing excellent-score green, preserving report semantics rather than copying a generated color literally.
- Images/icons: existing real sleep/calcium product PNGs, contain/aspect preserved, no invented pack contents. Back/chevron asset reuses the existing report icon path. Images use no-referrer; failed product images have a neutral state. No illustration was approximated with CSS or fabricated product imagery.
- Copy/content: actual backend names, plan/product descriptions, scores and strict thresholds. Correct double action layout; both primary-indicator actions share one target. No price, dosage, course, diagnosis or claims were generated. Empty body hides the source mock's disclosure affordance as required.

## Browser and behavior verification

- In-app browser, real isolated API, existing read-only database sources; console error logs checked: none during plan/AI verification.
- All three entry routes checked: home card, system recommendation and AI plan list.
- Plan→indicator→same plan, plan→AI→same plan; leave cancellation/confirmation preserved. No user question was submitted. AI conversation remained blank apart from its existing unsent entry prompt.
- AI expanded list and original context restored, including browser Back through a nested plan source; system reading position restored (857px in the observed run).
- Widths320/375/390/414 with heights667/812/844/896: no horizontal overflow, body16px, Back44×44, indicator shortcut≥44px tall, bottom buttons50px tall. See `responsive-metrics.json`.
- At320×667, after scrolling finishes: header top0, product note bottom≈476, dock top≈526; note is readable above the dock. Keyboard/aria component behavior and reduced-motion CSS rules verified. Physical-device soft keyboard and OS motion preference switching were not exercised in this desktop run.
- 20 warm-cache reload-to-visible-heading observations against real read-only sources: p95=508ms, min274ms, max4195ms. Includes browser-controller overhead; one outlier, no claim about all devices/cold caches. See `loading-metrics.json`.

## Follow-up acceptance

- Five-person SC-002 usability review not performed; do not substitute simulated reviewers.
- Physical-device keyboard/OS preference checks remain a manual acceptance item.
- Existing full-frontend suite has3 citation-fixture failures, reproduced against baseline commit `c563da6`'s unchanged AiConsult; related feature tests pass. This does not represent a new plan-page regression.

final result: passed
