<template>
  <main
    class="app-shell detail-v2 detail-skeleton"
    data-testid="system-detail-skeleton"
    aria-busy="true"
    aria-live="polite"
  >
    <span class="detail-skeleton-sr-only" role="status">系统详情正在加载中</span>

    <header class="detail-skeleton-nav" aria-hidden="true">
      <span class="detail-skeleton-back" />
      <span class="detail-skeleton-line detail-skeleton-line--nav-title" />
    </header>

    <section class="detail-skeleton-score" aria-hidden="true">
      <div class="detail-skeleton-identity">
        <span class="detail-skeleton-icon" />
        <div>
          <span class="detail-skeleton-line detail-skeleton-line--status" />
          <span class="detail-skeleton-line detail-skeleton-line--system-title" />
          <span class="detail-skeleton-line detail-skeleton-line--summary" />
        </div>
      </div>
      <span class="detail-skeleton-score-number" />
    </section>

    <section class="detail-skeleton-chart-panel" aria-hidden="true">
      <div class="detail-skeleton-panel-head">
        <div>
          <span class="detail-skeleton-line detail-skeleton-line--eyebrow" />
          <span class="detail-skeleton-line detail-skeleton-line--panel-title" />
        </div>
        <span class="detail-skeleton-line detail-skeleton-line--period" />
      </div>
      <div class="detail-skeleton-chart">
        <span v-for="index in 4" :key="index" class="detail-skeleton-chart-card" />
      </div>
    </section>

    <section class="detail-skeleton-editorial" aria-hidden="true">
      <span class="detail-skeleton-line detail-skeleton-line--eyebrow" />
      <span class="detail-skeleton-line detail-skeleton-line--section-title" />
      <div class="detail-skeleton-rows">
        <div v-for="index in 4" :key="index" class="detail-skeleton-row">
          <span class="detail-skeleton-line detail-skeleton-line--indicator" />
          <span class="detail-skeleton-progress"><i :style="{ width: `${76 - index * 7}%` }" /></span>
          <span class="detail-skeleton-value" />
        </div>
      </div>
    </section>

    <section class="detail-skeleton-conclusion" aria-hidden="true">
      <span class="detail-skeleton-line detail-skeleton-line--eyebrow" />
      <span class="detail-skeleton-line detail-skeleton-line--section-title" />
      <span class="detail-skeleton-line detail-skeleton-line--copy" />
      <span class="detail-skeleton-line detail-skeleton-line--copy detail-skeleton-line--copy-short" />
      <span class="detail-skeleton-line detail-skeleton-line--action" />
      <span class="detail-skeleton-line detail-skeleton-line--action detail-skeleton-line--action-short" />
    </section>
  </main>
</template>

<style scoped>
.detail-skeleton {
  --detail-skeleton-base: rgba(71, 100, 148, 0.1);
  --detail-skeleton-shine: rgba(255, 255, 255, 0.78);
  min-height: 100vh;
  padding-bottom: 30px;
  background: #f7faff;
}

.detail-skeleton-sr-only {
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

.detail-skeleton-line,
.detail-skeleton-back,
.detail-skeleton-icon,
.detail-skeleton-score-number,
.detail-skeleton-chart-card,
.detail-skeleton-value {
  display: block;
  border-radius: 999px;
  background: linear-gradient(100deg, var(--detail-skeleton-base) 25%, var(--detail-skeleton-shine) 43%, var(--detail-skeleton-base) 61%);
  background-size: 230% 100%;
  animation: detail-skeleton-shimmer 1.55s ease-in-out infinite;
}

.detail-skeleton-nav {
  display: grid;
  height: 68px;
  padding: 0 24px;
  border-bottom: 1px solid rgba(55, 82, 124, 0.08);
  background: #fff;
  grid-template-columns: 42px 1fr 42px;
  align-items: center;
}

.detail-skeleton-back { width: 32px; height: 32px; }
.detail-skeleton-line--nav-title { width: 116px; height: 20px; justify-self: center; border-radius: 7px; }

.detail-skeleton-score {
  display: flex;
  min-height: 187px;
  padding: 29px 25px;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(115deg, #e9f4ff, #d9eafc);
}

.detail-skeleton-identity { display: flex; max-width: 68%; align-items: center; gap: 15px; }
.detail-skeleton-icon { width: 52px; height: 52px; flex: 0 0 auto; border-radius: 16px; background-color: rgba(255, 255, 255, 0.78); }
.detail-skeleton-line--status { width: 58px; height: 10px; }
.detail-skeleton-line--system-title { width: 108px; height: 29px; margin-top: 13px; border-radius: 8px; }
.detail-skeleton-line--summary { width: min(176px, 100%); height: 11px; margin-top: 14px; }
.detail-skeleton-score-number { width: 72px; height: 94px; border-radius: 22px; }

.detail-skeleton-chart-panel,
.detail-skeleton-editorial,
.detail-skeleton-conclusion {
  margin: 14px 12px 0;
  padding: 24px;
  border: 1px solid rgba(65, 95, 140, 0.07);
  border-radius: 24px;
  background: #fff;
}

.detail-skeleton-panel-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.detail-skeleton-line--eyebrow { width: 120px; height: 9px; }
.detail-skeleton-line--panel-title { width: 105px; height: 25px; margin-top: 13px; border-radius: 7px; }
.detail-skeleton-line--period { width: 86px; height: 10px; margin-bottom: 4px; }

.detail-skeleton-chart {
  display: grid;
  min-height: 146px;
  margin-top: 23px;
  padding: 16px;
  border-radius: 19px;
  background: #eff5fc;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
}

.detail-skeleton-chart-card { height: 50px; border-radius: 14px; }

.detail-skeleton-editorial { padding-bottom: 19px; }
.detail-skeleton-line--section-title { width: 110px; height: 26px; margin-top: 13px; border-radius: 7px; }
.detail-skeleton-rows { margin-top: 20px; }
.detail-skeleton-row {
  display: grid;
  min-height: 53px;
  border-top: 1px solid rgba(70, 100, 145, 0.08);
  grid-template-columns: 72px 1fr 28px;
  gap: 12px;
  align-items: center;
}
.detail-skeleton-row:first-child { border-top: 0; }
.detail-skeleton-line--indicator { width: 65px; height: 12px; }
.detail-skeleton-progress { display: block; height: 7px; overflow: hidden; border-radius: 999px; background: #eaf0f8; }
.detail-skeleton-progress i { display: block; height: 100%; border-radius: inherit; background: rgba(83, 120, 186, 0.3); }
.detail-skeleton-value { width: 26px; height: 19px; justify-self: end; border-radius: 5px; }

.detail-skeleton-conclusion { min-height: 196px; background: linear-gradient(145deg, #edf5ff, #f7fbff); }
.detail-skeleton-line--copy { width: 100%; height: 11px; margin-top: 17px; }
.detail-skeleton-line--copy-short { width: 72%; margin-top: 11px; }
.detail-skeleton-line--action { width: 94%; height: 10px; margin-top: 19px; }
.detail-skeleton-line--action-short { width: 70%; margin-top: 15px; }

@keyframes detail-skeleton-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -130% 0; }
}

@media (max-width: 360px) {
  .detail-skeleton-nav { padding-right: 18px; padding-left: 18px; }
  .detail-skeleton-score { padding-right: 19px; padding-left: 19px; }
  .detail-skeleton-chart-panel,
  .detail-skeleton-editorial,
  .detail-skeleton-conclusion { padding: 20px; }
}

@media (prefers-reduced-motion: reduce) {
  .detail-skeleton-line,
  .detail-skeleton-back,
  .detail-skeleton-icon,
  .detail-skeleton-score-number,
  .detail-skeleton-chart-card,
  .detail-skeleton-value { animation: none; }
}
</style>
