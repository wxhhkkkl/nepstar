# Quickstart: V2 Vue Migration

## Scope

Run all commands from:

```text
/Users/leelee/Desktop/体检报告/nepstar/reportFront/report-v2
```

Do not run scaffolding commands from the repository root or another report version.

## Prerequisites

- Node.js `^22.18.0 || >=24.12.0`
- npm bundled with that Node version
- A Chromium browser for end-to-end and long-image verification

The machine's default Node 12 belongs to the legacy KH503 workflow and is not compatible with this V2 Vue project. Use a project-specific modern Node executable or a version manager; do not upgrade KH503 as part of this feature.

## Planned commands

After `/speckit-implement` creates the Vue project:

```bash
nvm use
npm install
npm run test
npm run test:e2e
npm run build
npm run dev -- --host 0.0.0.0
```

Expected development URLs:

```text
http://localhost:5173/#/
http://localhost:5173/#/system/endocrine
http://localhost:5173/#/system/bone
http://localhost:5173/detail.html?id=endocrine  # legacy compatibility redirect
```

For LAN access, use the IP printed by Vite after starting with `--host`.

## TDD workflow

For each implementation slice:

1. Add the test for the required legacy behavior.
2. Run the focused test and confirm it fails for the missing Vue implementation.
3. Implement the minimum Vue component or helper.
4. Run the focused test until green.
5. Run all tests before moving to the next slice.

## Verification checklist

### Home

- Score stops at 68 and uses warning color below 70.
- Endocrine and its sleep plan appear first, followed by bone and its calcium-loss plan.
- All seven applicable systems render.
- Both product images are complete.
- AI entry remains fixed and usable.
- Save action downloads the current long image and shows feedback.

### Detail

- Test all IDs: `cardio`, `lung`, `endocrine`, `bone`, `digest`, `female`, `immune`.
- Name, score, indicators and chart match the home data.
- Endocrine shows only sleep recommendation.
- Bone shows only calcium-loss recommendation.
- Other systems show no recommendation.
- Unknown ID shows the unavailable state.
- Refreshing a Hash detail URL still renders the selected system without server fallback configuration.
- A legacy `detail.html?id=<systemId>` URL redirects to the matching Hash route.
- Returning to home restores the prior scroll position.

### Responsive

Run automated checks at 320, 375, 390, 768 and 1440 pixels. Verify no horizontal overflow, clipped product, hidden card or large trailing blank area. At 390 pixels, the footer's AI safety space may remain but trailing blank space must not exceed 140 CSS pixels.

### Network

Record browser requests during all home and detail flows. No backend or other remote business request may occur.

## Build output

`npm run build` is expected to produce a static `dist/` containing the Vue application entry, the legacy detail compatibility page and all directly referenced report assets. Preview the build before visual approval; passing only the development server is insufficient.

## Verified implementation result

Verified on 2026-09-15 with Node 24.19.0:

- 27 Vitest unit/component tests passed.
- 23 Playwright tests passed against the production preview.
- `dist/index.html`, `dist/detail.html` and all five fixed PNG assets returned HTTP 200.
- The home long image remained 390×4442 and 1440×4246; endocrine and bone detail heights also matched the captured legacy geometry.
- LAN startup command: `npm run dev -- --host 0.0.0.0`; if the shell is still on Node 12, use the modern Node executable documented in `reportFront/report-v2/README.md`.
