<template>
  <main class="app-shell ai-welcome-skeleton" data-testid="ai-consult-skeleton" aria-busy="true">
    <span class="sr-only" role="status">正在准备咨询页面</span>
    <header class="skeleton-top" aria-hidden="true"><i /><i /></header>
    <section class="skeleton-body" aria-hidden="true">
      <div class="skeleton-hero"><div><i /><i /><i /></div><span /></div>
      <div class="skeleton-report"><i /><i /></div>
      <div class="skeleton-plans"><i /><div><i /><span><i /><i /></span></div></div>
      <div class="skeleton-questions"><div v-for="number in 3" :key="number" class="skeleton-suggestion"><i /><span><i /></span></div></div>
    </section>
  </main>
</template>

<style scoped>
.ai-welcome-skeleton { max-width: 480px; min-height: 100svh; background: radial-gradient(ellipse at 100% 0%, #dcfaf4a6, transparent 45%), linear-gradient(155deg, #eaf6ff, #f5f3ff); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
.skeleton-top { height: 72px; padding: 8px 18px; display: grid; grid-template-columns: 42px 1fr 42px; gap: 18px; align-items: center; }
.skeleton-body { padding: 0 16px 36px; }
.skeleton-top i, .skeleton-report i, .skeleton-hero i, .skeleton-hero>span, .skeleton-copy i, .skeleton-suggestion i, .skeleton-plans i {
  display: block; border-radius: 10px; background: linear-gradient(100deg, #e7eef7 25%, #f4f8fc 50%, #e7eef7 75%);
  background-size: 220% 100%; animation: ai-shimmer 1.8s ease-in-out infinite;
}
.skeleton-top i:first-child { width: 44px; height: 44px; border-radius: 50%; }
.skeleton-top i:last-child { width: 120px; height: 23px; justify-self: center; }
.skeleton-report { display: flex; align-items: center; gap: 25px; height: 176px; margin: 0 0 12px; padding: 17px; border: 1px solid #fff; border-radius: 25px; background: #fff; }
.skeleton-report i:first-child { width: 116px; height: 116px; border-radius: 50%; flex: none; }
.skeleton-report i:last-child { width: 60%; height: 72px; }
.skeleton-hero { display: flex; align-items: center; gap: 15px; height: 166px; padding: 0 7px; }
.skeleton-hero>div { flex: 1; }
.skeleton-hero i:first-child { width: 82%; height: 10px; margin-bottom: 16px; }
.skeleton-hero i:nth-child(2) { width: 62%; height: 25px; margin-bottom: 10px; }
.skeleton-hero i:nth-child(3) { width: 95%; height: 25px; }
.skeleton-hero>span { width: 108px; height: 140px; border-radius: 60px 60px 0 0; flex: none; }
.skeleton-copy { margin: 18px 7px 0 110px; }
.skeleton-copy i { width: 95%; height: 12px; margin-bottom: 12px; }
.skeleton-copy i:last-child { width: 69%; }
.skeleton-plans { padding: 16px 11px 11px; border: 1px solid #fff; border-radius: 25px; background: #faf8ff; }
.skeleton-plans>i { width: 80%; height: 14px; margin: 0 5px 12px; }
.skeleton-plans>div { display: flex; align-items: center; gap: 12px; padding: 5px; margin-top: 9px; border-radius: 19px; background: #fff; }
.skeleton-plans>div>i { width: 70px; height: 72px; flex: none; border-radius: 15px; }
.skeleton-plans>div>span { flex: 1; }
.skeleton-plans span i { width: 80%; height: 14px; }
.skeleton-plans span i:last-child { width: 66%; height: 10px; margin-top: 13px; }
.skeleton-questions { margin-top: 12px; padding: 10px; border-radius: 25px; background: #ffffffd9; }
.skeleton-suggestion { display: flex; align-items: center; gap: 14px; min-height: 46px; margin-top: 6px; padding: 7px; border: 1px solid #e7eef6; border-radius: 16px; background: #fff; }
.skeleton-suggestion>i { width: 30px; height: 31px; border-radius: 10px; flex: none; }
.skeleton-suggestion span { flex: 1; }
.skeleton-suggestion span i:first-child { width: 78%; height: 13px; }
.skeleton-suggestion span i:last-child { width: 53%; height: 10px; margin-top: 9px; }
@keyframes ai-shimmer { to { background-position-x: -220%; } }
@media (max-width: 359px) { .skeleton-top { height: 68px; } .skeleton-body { padding-inline: 12px; } .skeleton-hero>span { width: 90px; } .skeleton-report i:first-child { width: 102px; height: 102px; } }
@media (prefers-reduced-motion: reduce) { .skeleton-top i, .skeleton-report i, .skeleton-hero i, .skeleton-hero>span, .skeleton-copy i, .skeleton-suggestion i, .skeleton-plans i { animation: none; } }
</style>
