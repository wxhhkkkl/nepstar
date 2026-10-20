<script setup>
import { computed } from 'vue'
import { useCardReveal } from '@/composables/useCardReveal.js'
import { clampScore } from '@/utils/chartGeometry.js'

const props = defineProps({
  system: { type: Object, required: true },
  indexLabel: { type: String, required: true },
})
const { element, isVisible } = useCardReveal()
const gaugePath = 'M20.2 59.8A28 28 0 1 1 59.8 59.8'
const colors = ['#d7a16e', '#a18cbd', '#63a98c']
const backgrounds = ['#fbf7f1', '#f6f3fb', '#f2f8f4']
const scoreValue = value => typeof value === 'number' && Number.isFinite(value) ? value : null
const totalScore = computed(() => scoreValue(props.system.score))
const metrics = computed(() => {
  const items = props.system.indicators?.length
    ? props.system.indicators
    : (props.system.visualization?.categories || []).map((name, index) => ({
        name, score: props.system.visualization?.series?.[index],
      }))
  return items.slice(0, 3).map((item, index) => ({
    key: item.indicator_code || `${item.name}-${index}`,
    name: item.name || `指标 ${index + 1}`,
    score: scoreValue(item.score),
    color: colors[index],
    background: backgrounds[index],
    delay: `${220 + index * 120}ms`,
  }))
})
</script>

<template>
  <div ref="element" class="lung-overview-panel" :class="{ 'is-visible': isVisible }">
    <div class="lung-summary-row">
      <div class="card-index">{{ indexLabel }} / LUNG</div>
      <div class="card-mini-head">
        <h3>{{ system.name }}</h3>
        <strong :aria-label="`综合活力值 ${totalScore ?? '未提供'}，满分 100`">{{ totalScore ?? '—' }}</strong>
      </div>
    </div>
    <div v-if="metrics.length" class="lung-metric-grid" aria-label="肺功能子级指标，满分 100 分">
      <div v-for="item in metrics" :key="item.key" class="lung-metric-tile" :style="{ '--gauge-color': item.color, '--gauge-background': item.background, '--gauge-fill': `${clampScore(item.score)} 100`, '--gauge-delay': item.delay }">
        <span class="lung-metric-name">{{ item.name }}</span>
        <div class="lung-metric-gauge">
          <svg class="lung-mini-gauge" viewBox="0 0 80 80" aria-hidden="true">
            <path class="lung-gauge-track" :d="gaugePath" />
            <path v-if="item.score !== null && item.score > 0" class="lung-gauge-fill" :d="gaugePath" pathLength="100" />
          </svg>
          <strong class="lung-metric-value">{{ item.score ?? '—' }}</strong>
        </div>
      </div>
    </div>
    <p v-else class="lung-metrics-empty">暂无子项指标</p>
  </div>
</template>

<style scoped>
.lung-overview-panel {
  min-width: 0;
}

.lung-overview-panel .lung-summary-row h3 {
  margin: 0;
}

.lung-mini-gauge {
  display: block;
  width: 100%;
  height: auto;
  fill: none;
}

.lung-gauge-track,
.lung-gauge-fill {
  stroke-width: 7;
  stroke-linecap: round;
}

.lung-gauge-track {
  stroke: #e5e9ed;
}

.lung-gauge-fill {
  stroke: var(--gauge-color);
  stroke-dasharray: 0 100;
  opacity: 0;
}

.lung-metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  margin-top: 10px;
}

.lung-metric-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 9px 4px 8px;
  border-radius: 12px;
  background: var(--gauge-background);
  text-align: center;
}

.lung-metric-name {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.8em;
  color: #6e7c91;
  font-size: var(--report-indicator-label-size);
  font-weight: 500;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.lung-metric-value {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #334660;
  font: 700 20px/1 var(--font-report-number);
  font-variant-numeric: tabular-nums;
}

.lung-metric-gauge {
  position: relative;
  width: 88px;
  max-width: 100%;
}

.lung-metrics-empty {
  color: #778398;
  font-size: 12px;
}

.lung-overview-panel.is-visible .lung-gauge-fill {
  animation: lung-gauge-draw 1s var(--gauge-delay) cubic-bezier(.22, .75, .3, 1) both;
}

@keyframes lung-gauge-draw {
  from { stroke-dasharray: 0 100; opacity: 0; }
  to { stroke-dasharray: var(--gauge-fill); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .lung-overview-panel .lung-gauge-fill,
  .lung-overview-panel.is-visible .lung-gauge-fill {
    animation: none;
    stroke-dasharray: var(--gauge-fill);
    opacity: 1;
  }
}

@media (max-width: 374px) {
  .lung-metric-value { font-size: 18px; }
}
</style>
