# V2 Migration Baseline

## Legacy capture

- Source: the unmodified static `index.html`, `detail.html`, `styles.css`, `overrides.css`, `data.js` and `app.js` present before the Vue migration.
- Captured with Google Chrome in headless mode and `prefers-reduced-motion: reduce`.
- Home viewports: 390×844 and 1440×1000.
- Detail viewport: 390×844 for `cardio`, `lung`, `endocrine`, `bone`, `digest`, `female` and `immune`.
- URLs use local `file:` documents only during the legacy capture.

Run the one-time legacy capture before replacing the static entry files:

```bash
/Users/leelee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/baseline/capture-legacy.mjs
```

The resulting PNGs in `tests/baseline/legacy/` are migration references, not pixel-perfect golden files. Dynamic browser rendering and font rasterization require semantic and geometry checks alongside image comparison.

## Vue verification

- Runtime: Node 24.19.0.
- Final unit/component result: 27 tests passed.
- Final production-preview browser result: 23 tests passed across home, seven details, routing, download, network, visual geometry and five viewport widths.
- Vue comparison captures are stored in `tests/baseline/vue/`.
- The migrated home retains the legacy full-page dimensions: 390×4442 and 1440×4246.
- The endocrine and bone detail captures retain 390×2437 and 390×2315 respectively.
- The bone recommendation image now eagerly loads for full-page capture instead of appearing as an empty lazy-load placeholder.
- Supporting legacy `app.js`, `data.js`, `detail.html` and CSS sources are archived under `../../code_v1/`; the files in `tests/baseline/legacy/` are screenshot references only.
