<script setup>
import { computed, useId } from 'vue'
import { scoreAppearance, scoreStyle } from '@/utils/scoreColor.js'

const props = defineProps({
  score: { type: Number, default: null },
  systems: { type: Array, default: () => [] },
  summary: { type: String, default: '' },
  date: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  reportTo: { type: Object, required: true },
})
const gradientId = `consult-score-${useId()}`
const scoreFill = computed(() => `${props.score ?? 0} 100`)
</script>

<template>
  <RouterLink v-if="compact" :to="reportTo" class="ai-report-compact" :style="scoreStyle(score)" :data-score-level="scoreAppearance(score).key" aria-label="查看当前关联报告">
    <span class="ai-connected"><i aria-hidden="true" /><span>已关联<span class="ai-connected-extra">本次</span>报告</span></span>
    <strong v-if="score !== null" class="ai-compact-score score-value">{{ score }} 分</strong>
    <span v-if="systems.length" class="ai-compact-focus" :style="scoreStyle(systems[0].score)">{{ systems[0].name }} · 活力值 <b class="score-value">{{ systems[0].score ?? '—' }}</b></span>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
  </RouterLink>
  <section v-else class="ai-report-strip" :style="scoreStyle(score)" :data-score-level="scoreAppearance(score).key" aria-label="当前关联报告">
    <header class="ai-report-meta">
      <span class="ai-connected"><i aria-hidden="true" />已连接本次报告</span>
      <time v-if="date" :datetime="date">{{ date.replaceAll('-', '.') }}</time>
    </header>
    <div class="ai-report-overview">
      <div class="ai-report-score" :class="{ 'ai-report-score--missing': score === null }">
        <svg v-if="score !== null" class="ai-score-ring" viewBox="0 0 120 120" aria-hidden="true">
          <defs><linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1"><stop :stop-color="scoreAppearance(score).accent" /><stop offset="1" :stop-color="scoreAppearance(score).color" /></linearGradient></defs>
          <circle class="ai-score-track" cx="60" cy="60" r="53" />
          <circle class="ai-score-fill" cx="60" cy="60" r="53" pathLength="100" :stroke="`url(#${gradientId})`" :stroke-dasharray="scoreFill" />
        </svg>
        <div class="ai-score-copy">
          <strong v-if="score !== null" class="score-value" data-testid="ai-report-score">{{ score }}<span class="ai-accessibility-only">分</span></strong>
          <strong v-else class="ai-score-missing">分数未提供</strong>
          <small>长寿指数</small>
        </div>
      </div>
      <div class="ai-report-focus">
        <span class="ai-focus-label">本次关注</span>
        <ul v-if="systems.length">
          <li v-for="system in systems" :key="system.name" :style="scoreStyle(system.score)">
            <svg v-if="system.name.includes('消化')" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v5c0 4 5-1 7 3 4 7-1 11-7 9-4-2-7-1-7-5 0-3 5-3 5-6V3" /></svg>
            <svg v-else-if="system.name.includes('肺')" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5v8M14 5v8M10 9C7 5 4 10 3 15c-1 5 6 5 7 1M14 9c3-4 6 1 7 6 1 5-6 5-7 1M10 13l2-2 2 2" /></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>
            <span>{{ system.name }}<span class="ai-accessibility-only"> · 活力值 </span></span>
            <strong class="score-value">{{ system.score ?? '—' }}</strong>
          </li>
        </ul>
        <p v-else>{{ summary }}</p>
      </div>
    </div>
    <span class="ai-accessibility-only">{{ summary }}</span>
  </section>
</template>

<style scoped>
.ai-report-strip { padding: 12px 14px; border: 1px solid #fff; border-radius: 26px; background: #fffffff0; box-shadow: 0 12px 35px #628ac009; }
.ai-report-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; margin-bottom: 10px; color: #7286a7; font-size: 14px; line-height: 1.4; }
.ai-connected { display: inline-flex; align-items: center; gap: 8px; color: #233e65; font-size: 14px; font-weight: 650; white-space: nowrap; }
.ai-connected i { width: 9px; height: 9px; flex: none; border-radius: 50%; background: #18b88b; box-shadow: 0 0 0 5px #dff6ee; margin-inline: 4px; }
.ai-report-overview { display: grid; grid-template-columns: 108px minmax(0, 1fr); align-items: center; gap: 16px; }
.ai-report-score { position: relative; width: 108px; height: 108px; }
.ai-score-ring { display: block; width: 100%; height: 100%; overflow: visible; transform: rotate(-90deg); fill: none; stroke-width: 7; }
.ai-score-track { stroke: #edf0fc; }
.ai-score-fill { stroke-linecap: round; animation: ai-score-draw 1s ease-out both; }
.ai-score-copy { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px; }
.ai-score-copy > strong { color: #142951; font-size: 42px; font-weight: 750; line-height: 1; letter-spacing: -1.5px; font-variant-numeric: tabular-nums; }
.ai-score-copy > .ai-score-missing { padding: 4px; font-size: 14px; letter-spacing: 0; }
.ai-score-copy small { font-size: 14px; color: #5f7598; }
.ai-report-focus { min-width: 0; padding-left: 14px; border-left: 1px solid #edf0fa; color: #3f567e; font-size: 14px; }
.ai-focus-label { display: block; margin-bottom: 6px; }
.ai-report-focus ul { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.ai-report-focus li { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 13px; background: var(--score-soft); }
.ai-report-focus li > svg { width: 23px; height: 23px; flex: none; color: var(--score-color); }
.ai-report-focus li > span { min-width: 0; overflow-wrap: anywhere; }
.ai-report-focus li > strong { margin-left: auto; flex: none; color: #172c51; font-size: 18px; font-weight: 700; }
.ai-report-focus p { margin: 0; line-height: 1.7; overflow-wrap: anywhere; }
.ai-report-compact { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 10px 13px; border: 1px solid #fff; border-radius: 18px; background: #ffffffec; box-shadow: 0 8px 28px #628ac008; }
.ai-compact-score { flex: none; padding: 4px 10px; border: 1px solid var(--score-border); border-radius: 20px; color: var(--score-color); background: var(--score-soft); font-size: 18px; line-height: 1.3; }
.ai-compact-focus { min-width: 0; margin-left: auto; color: #7286a7; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-report-compact > svg { width: 17px; height: 17px; flex: none; margin-left: auto; color: #7d91b1; }
.ai-report-compact:focus-visible { outline: 3px solid #8db4ef; outline-offset: 3px; }
.ai-accessibility-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@keyframes ai-score-draw { from { stroke-dasharray: 0 100; } }
@media (min-width: 390px) and (max-width: 429px) {
  .ai-report-compact { gap: 7px; }
  .ai-connected-extra { display: none; }
}
@media (max-width: 389px) {
  .ai-report-overview { grid-template-columns: 102px minmax(0, 1fr); gap: 10px; }
  .ai-report-score { width: 102px; height: 102px; }
  .ai-report-focus { padding-left: 10px; }
  .ai-report-focus li { padding: 7px 8px; gap: 5px; }
  .ai-report-focus li > svg { display: none; }
  .ai-report-compact { flex-wrap: wrap; gap: 8px; }
  .ai-compact-focus { order: 1; flex-basis: 100%; margin-left: 0; padding-left: 4px; }
}
@media (prefers-reduced-motion: reduce) { .ai-score-fill { animation: none; } }
</style>
