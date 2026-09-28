<template>
  <main
    class="app-shell report-v2 report-home-skeleton"
    data-testid="report-home-skeleton"
    aria-busy="true"
    aria-live="polite"
  >
    <span class="skeleton-sr-only" role="status">报告正在加载中</span>

    <section class="skeleton-score-panel" aria-hidden="true">
      <div class="skeleton-score-meta">
        <span class="skeleton-line skeleton-line--date" />
        <span class="skeleton-chip" />
      </div>
      <div class="skeleton-score-stage">
        <span class="skeleton-orbit skeleton-orbit--outer" />
        <span class="skeleton-orbit skeleton-orbit--inner" />
        <span class="skeleton-score-core" />
      </div>
      <div class="skeleton-score-foot">
        <span class="skeleton-stat" />
        <span class="skeleton-divider" />
        <span class="skeleton-stat skeleton-stat--short" />
        <span class="skeleton-button" />
      </div>
    </section>

    <section class="skeleton-intro" aria-hidden="true">
      <span class="skeleton-line skeleton-line--eyebrow" />
      <span class="skeleton-line skeleton-line--title" />
      <span class="skeleton-line skeleton-line--copy" />
      <span class="skeleton-line skeleton-line--copy skeleton-line--copy-short" />
    </section>

    <section class="skeleton-summary-grid" aria-hidden="true">
      <div class="skeleton-summary-card skeleton-summary-card--large">
        <span class="skeleton-line skeleton-line--eyebrow" />
        <span class="skeleton-line skeleton-line--card-title" />
        <span class="skeleton-number" />
      </div>
      <div class="skeleton-summary-card">
        <span class="skeleton-line skeleton-line--eyebrow" />
        <span class="skeleton-line skeleton-line--card-title" />
        <span class="skeleton-number skeleton-number--small" />
      </div>
      <div class="skeleton-summary-card skeleton-summary-card--wide">
        <span class="skeleton-line skeleton-line--eyebrow" />
        <span class="skeleton-line skeleton-line--card-title" />
        <span class="skeleton-line skeleton-line--copy skeleton-line--copy-short" />
      </div>
    </section>

    <section class="skeleton-systems" aria-hidden="true">
      <div class="skeleton-section-heading">
        <span class="skeleton-line skeleton-line--eyebrow" />
        <span class="skeleton-line skeleton-line--heading" />
      </div>
      <div class="skeleton-system-grid">
        <div v-for="index in 4" :key="index" class="skeleton-system-card">
          <span class="skeleton-line skeleton-line--eyebrow" />
          <span class="skeleton-line skeleton-line--card-title" />
          <span class="skeleton-line skeleton-line--copy" />
          <span class="skeleton-system-chart" />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.report-home-skeleton {
  --skeleton-base: rgba(77, 104, 145, 0.1);
  --skeleton-shine: rgba(255, 255, 255, 0.76);
  padding-bottom: 32px;
}

.skeleton-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.skeleton-line,
.skeleton-chip,
.skeleton-button,
.skeleton-stat,
.skeleton-number,
.skeleton-system-chart {
  display: block;
  border-radius: 999px;
  background: linear-gradient(100deg, var(--skeleton-base) 25%, var(--skeleton-shine) 43%, var(--skeleton-base) 61%);
  background-size: 230% 100%;
  animation: skeleton-shimmer 1.55s ease-in-out infinite;
}

.skeleton-score-panel {
  min-height: 386px;
  padding: 26px 24px 22px;
  overflow: hidden;
  border-radius: 0 0 34px 34px;
  background:
    radial-gradient(circle at 50% 43%, rgba(255, 255, 255, 0.88), transparent 36%),
    linear-gradient(145deg, #f9eee7 0%, #fff6ee 54%, #eaf3ff 100%);
}

.skeleton-score-meta,
.skeleton-score-foot {
  display: flex;
  align-items: center;
}

.skeleton-score-meta {
  justify-content: space-between;
}

.skeleton-line--date { width: 118px; height: 11px; }
.skeleton-chip { width: 74px; height: 32px; }

.skeleton-score-stage {
  position: relative;
  display: grid;
  width: 216px;
  height: 216px;
  margin: 14px auto 5px;
  place-items: center;
}

.skeleton-orbit {
  position: absolute;
  border: 1px solid rgba(106, 132, 177, 0.22);
  border-radius: 50%;
}

.skeleton-orbit--outer { width: 204px; height: 204px; }
.skeleton-orbit--inner { width: 154px; height: 154px; border-style: dashed; }

.skeleton-score-core {
  width: 104px;
  height: 104px;
  border: 9px solid rgba(110, 136, 179, 0.13);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.54);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.65);
}

.skeleton-score-foot {
  gap: 13px;
  justify-content: space-between;
  padding-top: 12px;
}

.skeleton-stat { width: 72px; height: 38px; border-radius: 10px; }
.skeleton-stat--short { width: 66px; }
.skeleton-divider { width: 1px; height: 36px; background: rgba(90, 115, 153, 0.16); }
.skeleton-button { width: 77px; height: 38px; border-radius: 12px; }

.skeleton-intro,
.skeleton-systems { padding: 34px 24px 0; }

.skeleton-line--eyebrow { width: 94px; height: 9px; }
.skeleton-line--title { width: min(230px, 72%); height: 30px; margin-top: 15px; border-radius: 8px; }
.skeleton-line--copy { width: 100%; height: 11px; margin-top: 13px; }
.skeleton-line--copy-short { width: 68%; }

.skeleton-summary-grid {
  display: grid;
  grid-template-columns: 1.18fr 0.82fr;
  gap: 12px;
  padding: 28px 24px 0;
}

.skeleton-summary-card,
.skeleton-system-card {
  min-height: 148px;
  padding: 18px;
  overflow: hidden;
  border: 1px solid rgba(62, 92, 138, 0.08);
  border-radius: 20px;
  background: #f2f6fc;
}

.skeleton-summary-card--large { background: #eaf1fb; }
.skeleton-summary-card--wide { grid-column: 1 / -1; min-height: 118px; background: #f9f4ed; }
.skeleton-line--card-title { width: 74%; height: 18px; margin-top: 14px; border-radius: 6px; }
.skeleton-number { width: 76px; height: 44px; margin-top: 19px; border-radius: 12px; }
.skeleton-number--small { width: 55px; }

.skeleton-section-heading { margin-bottom: 17px; }
.skeleton-line--heading { width: 156px; height: 25px; margin-top: 13px; border-radius: 7px; }

.skeleton-system-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.skeleton-system-card { min-height: 188px; }
.skeleton-system-card .skeleton-line--card-title { width: 66%; }
.skeleton-system-card .skeleton-line--copy { width: 84%; }
.skeleton-system-chart { width: 100%; height: 57px; margin-top: 20px; border-radius: 14px; opacity: 0.82; }

@keyframes skeleton-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -130% 0; }
}

@media (max-width: 360px) {
  .skeleton-score-panel { padding-right: 18px; padding-left: 18px; }
  .skeleton-intro,
  .skeleton-systems,
  .skeleton-summary-grid { padding-right: 18px; padding-left: 18px; }
  .skeleton-score-stage { transform: scale(0.92); margin-top: 5px; margin-bottom: -4px; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line,
  .skeleton-chip,
  .skeleton-button,
  .skeleton-stat,
  .skeleton-number,
  .skeleton-system-chart { animation: none; }
}
</style>
