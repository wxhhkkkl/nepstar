# Mock Report Data Contract

## Module boundary

`src/data/report.js` MUST export one immutable report snapshot and MUST NOT read browser globals, storage or remote resources at module initialization time.

Recommended exports:

```js
export const reportSnapshot = { /* ReportSnapshot */ }
export function getVisibleSystems(report) { /* pure */ }
export function getSystemById(report, id) { /* pure */ }
export function buildHomeFlow(report) { /* pure */ }
```

The exported objects use JavaScript only. No TypeScript declarations or runtime schema library is required in this phase.

## Report invariants

- `score === 68`
- `warningThreshold === 70`
- `systems` contains unique IDs.
- Seven systems are applicable for the current female report.
- The male system may remain in source data but is not applicable or visible.
- Every applicable system has one supported visualization.
- Home and detail views receive the same object reference for a given system.
- No data function performs `fetch`, XMLHttpRequest or Axios calls.

## Home flow contract

`buildHomeFlow(report)` returns an ordered array of entries:

```js
[
  { type: 'system-group', systemIds: ['endocrine', 'lung'] },
  { type: 'recommendation', systemId: 'endocrine' },
  { type: 'system', systemId: 'bone' },
  { type: 'recommendation', systemId: 'bone' },
  { type: 'system', systemId: 'cardio' },
  { type: 'system', systemId: 'digest' },
  { type: 'system', systemId: 'female' },
  { type: 'system', systemId: 'immune' }
]
```

This is the current visual order. It MUST be represented by rendered data order rather than relying only on CSS `order`.

## Recommendation contract

```js
{
  issue: String,
  title: String,
  context: String,
  tags: [String, String],
  image: String,
  imageAlt: String,
  actionLabel: String,
  actionHint: String
}
```

- `endocrine.recommendation.title` is “睡眠健康管理方案”.
- `bone.recommendation.title` is “钙流失健康管理方案”.
- Product images use `object-fit: contain` and MUST be fully visible.
- Other applicable systems have no recommendation entry.

## Detail lookup contract

`getSystemById(report, id)` returns the matching applicable system or `null`. It MUST NOT silently fall back to the first system for an unknown ID, because that displays incorrect health data.

## Mutation contract

Components MUST treat report data as read-only. Animation values, feedback flags and scroll position belong to view state and MUST NOT mutate the report snapshot.
