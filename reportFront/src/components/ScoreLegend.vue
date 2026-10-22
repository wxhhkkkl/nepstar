<script setup>
import { SCORE_BANDS, scoreStyle } from '@/utils/scoreColor.js'
</script>

<template>
  <div class="score-legend" aria-label="评分颜色说明，分数越高表现越好">
    <span class="score-legend-caption">活力值越高，表现越好</span>
    <ul>
      <li v-for="band in SCORE_BANDS" :key="band.key" :style="scoreStyle(band.min)">
        <span><i aria-hidden="true" />{{ band.label }}</span>
        <small>{{ band.range }}</small>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.score-legend { margin: 12px; padding: 14px 12px; border: 1px solid #e3e9ef; border-radius: 18px; background: #ffffffc9; }
.score-legend-caption { display: block; margin-bottom: 12px; color: #6b7789; font-size: 14px; }
.score-legend ul { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 0; padding: 0; list-style: none; }
.score-legend li { min-width: 0; color: var(--score-color); font-size: 14px; line-height: 1.5; }
.score-legend li > span { display: flex; align-items: center; gap: 4px; font-weight: 600; white-space: nowrap; }
.score-legend i { flex: 0 0 5px; height: 5px; border-radius: 50%; background: var(--score-color); }
.score-legend small { display: block; margin-top: 3px; padding-left: 9px; color: #7c8797; font: 13px/1.4 var(--font-report-number); }
@media (max-width: 359px) { .score-legend li { font-size: 13px; } }
</style>
