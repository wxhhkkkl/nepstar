<template>
  <main class="app-shell indicator-detail-page indicator-skeleton" data-testid="indicator-detail-skeleton" aria-busy="true" aria-live="polite">
    <span class="indicator-skeleton-sr-only" role="status">指标详情正在加载中</span>
    <header class="indicator-detail-nav" aria-hidden="true"><i class="indicator-skeleton-line indicator-skeleton-back" /><i class="indicator-skeleton-line indicator-skeleton-title" /><span /></header>
    <section class="indicator-hero" aria-hidden="true">
      <div class="indicator-hero-main"><div class="indicator-skeleton-copy"><i class="indicator-skeleton-line indicator-skeleton-pill" /><i class="indicator-skeleton-line indicator-skeleton-name" /><i class="indicator-skeleton-line indicator-skeleton-subtitle" /></div><i class="indicator-skeleton-line indicator-skeleton-ring" /></div>
      <div class="indicator-hero-facts"><i v-for="index in 3" :key="index" class="indicator-skeleton-line indicator-skeleton-fact" /></div>
    </section>
    <section class="indicator-panel" aria-hidden="true"><i class="indicator-skeleton-line indicator-skeleton-eyebrow" /><i class="indicator-skeleton-line indicator-skeleton-heading" /><i class="indicator-skeleton-line indicator-skeleton-copyline" /><i class="indicator-skeleton-line indicator-skeleton-copyline short" /></section>
    <section class="indicator-panel" aria-hidden="true"><i class="indicator-skeleton-line indicator-skeleton-eyebrow" /><i class="indicator-skeleton-line indicator-skeleton-heading" /><i class="indicator-skeleton-line indicator-skeleton-chart" /></section>
    <section class="indicator-actions" aria-hidden="true"><i class="indicator-skeleton-line indicator-skeleton-eyebrow" /><i class="indicator-skeleton-line indicator-skeleton-heading" /><i v-for="index in 3" :key="index" class="indicator-skeleton-line indicator-skeleton-action" /></section>
  </main>
</template>
