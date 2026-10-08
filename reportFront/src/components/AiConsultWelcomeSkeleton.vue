<template>
  <main class="app-shell ai-welcome-skeleton" data-testid="ai-consult-skeleton" aria-busy="true">
    <span class="sr-only" role="status">正在准备咨询页面</span>
    <header class="skeleton-top" aria-hidden="true"><i /><i /></header>
    <section class="skeleton-body" aria-hidden="true">
      <div class="skeleton-report"><i /><i /></div>
      <div class="skeleton-hero"><i /><i /><span /></div>
      <div class="skeleton-copy"><i /><i /></div>
      <div v-for="number in 3" :key="number" class="skeleton-suggestion"><i /><span><i /><i /></span></div>
    </section>
  </main>
</template>

<style scoped>
.ai-welcome-skeleton { min-height: 100svh; background: #f6f9fc; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
.skeleton-top { height: 72px; padding: 20px 22px; display: flex; align-items: center; justify-content: space-between; background: #fff; }
.skeleton-body { padding: 18px 22px 36px; }
.skeleton-top i, .skeleton-report i, .skeleton-hero i, .skeleton-hero span, .skeleton-copy i, .skeleton-suggestion i {
  display: block; border-radius: 10px; background: linear-gradient(100deg, #e7eef7 25%, #f4f8fc 50%, #e7eef7 75%);
  background-size: 220% 100%; animation: ai-shimmer 1.8s ease-in-out infinite;
}
.skeleton-top i:first-child { width: 30px; height: 30px; }
.skeleton-top i:last-child { width: 120px; height: 17px; }
.skeleton-report { display: flex; align-items: center; justify-content: space-between; height: 66px; padding: 17px; border: 1px solid #e7eef6; border-radius: 18px; background: #fff; }
.skeleton-report i:first-child { width: 45%; height: 14px; }
.skeleton-report i:last-child { width: 62px; height: 12px; }
.skeleton-hero { position: relative; height: 183px; padding-top: 43px; }
.skeleton-hero i:first-child { width: 58%; height: 29px; }
.skeleton-hero i:nth-child(2) { width: 44%; height: 29px; margin-top: 14px; }
.skeleton-hero span { position: absolute; top: 24px; right: 0; width: 105px; height: 112px; border-radius: 50%; }
.skeleton-copy i { width: 88%; height: 12px; margin-bottom: 12px; }
.skeleton-copy i:last-child { width: 69%; }
.skeleton-suggestion { display: flex; align-items: center; gap: 14px; min-height: 78px; margin-top: 11px; padding: 14px; border: 1px solid #e7eef6; border-radius: 18px; background: #fff; }
.skeleton-suggestion>i { width: 39px; height: 39px; border-radius: 12px; flex: none; }
.skeleton-suggestion span { flex: 1; }
.skeleton-suggestion span i:first-child { width: 78%; height: 13px; }
.skeleton-suggestion span i:last-child { width: 53%; height: 10px; margin-top: 9px; }
@keyframes ai-shimmer { to { background-position-x: -220%; } }
@media (prefers-reduced-motion: reduce) { .skeleton-top i, .skeleton-report i, .skeleton-hero i, .skeleton-hero span, .skeleton-copy i, .skeleton-suggestion i { animation: none; } }
</style>
