# UI Behavior Contract

## Entry points

| URL | Result |
|---|---|
| `/#/` | V2 report home |
| `/#/system/cardio` | Cardio detail |
| `/#/system/lung` | Lung detail |
| `/#/system/endocrine` | Endocrine detail with sleep recommendation |
| `/#/system/bone` | Bone detail with calcium-loss recommendation |
| `/#/system/digest` | Digest detail |
| `/#/system/female` | Female detail |
| `/#/system/immune` | Immunity detail |
| `/#/system/<unknown>` | Explicit unavailable state with home link |
| unmatched route | Home or an explicit recoverable state; never a blank page |

## Legacy URL compatibility

| Legacy URL | Required result |
|---|---|
| `/detail.html?id=<valid-id>` | Redirect to `/#/system/<valid-id>` |
| `/detail.html` | Redirect to `/#/` |
| `/detail.html?id=<unknown>` | Redirect to the unknown-system fallback or home without throwing |

## Home behavior

1. Render the report shell and final layout before optional animation starts.
2. Apply warning styling whenever the report score is below 70.
3. Animate the visible score from 0 to 68 once; replay remains available if present in the baseline.
4. With reduced motion enabled, render 68 immediately and expose all system cards.
5. Reveal cards at most once per page lifetime; failure or absence of `IntersectionObserver` reveals all cards.
6. Render recommendation immediately after its related low-score system.
7. Keep the AI entry fixed in its existing safe area without blocking actions or footer text.
8. The AI entry's interactive rectangle remains at least 44 × 44 CSS pixels.

## Detail behavior

1. Read only the `systemId` route parameter for the canonical detail view.
2. Render name, score, status, summary, icon, visualization, indicators, direct measurements, interpretation and actions from the selected shared system object.
3. Hide the direct-measurement section when `direct` is empty.
4. Render a recommendation only when the selected system owns one.
5. Preserve product image aspect ratio and show the entire product.
6. Unknown IDs render a clear unavailable state; they do not substitute another system.

## Navigation and scroll

- Before navigating from a system card, store the current vertical scroll position under a V2-specific session key.
- System cards navigate through Vue Router; direct refresh of a Hash detail route must continue to work without server fallback configuration.
- On home mount, restore a finite positive stored value after layout is ready.
- A direct detail visit without stored position returns to home at its normal initial position.
- All navigation remains usable with keyboard activation.

## Save report

- The save action points to the current static `长寿指数报告V2_手机长图.png`.
- One activation initiates a browser download when supported.
- The button and toast expose a temporary “已保存” state and then return to idle.
- If download is unavailable, the user receives a visible fallback instead of a silent failure.

## AI consultation

- The floating entry remains visible while scrolling.
- Activation opens the existing `AI长寿咨询聊天页设计稿.png` asset.
- No chat UI, network request or AI service is implemented in this feature.

## Responsive and visual checks

For 320, 375, 390, 768 and 1440 pixel viewport widths:

- `document.documentElement.scrollWidth <= window.innerWidth`
- No system or recommendation content is hidden at animation end.
- Product images are complete, not clipped.
- No unexpected blank region appears between the last content card and footer.
- At 390 pixels wide, footer safety space reserved for the fixed AI entry is allowed but the trailing blank region MUST NOT exceed 140 CSS pixels.
- Fixed AI controls do not cover primary text or buttons.

## Network contract

During home/detail acceptance flows, requests are limited to the local document, JavaScript, CSS, fonts if already local, and project image assets. Any request to `/api/`, `http://` or `https://` business endpoints fails the test.
