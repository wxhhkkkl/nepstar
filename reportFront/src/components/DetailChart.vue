<script setup>
import { computed } from 'vue'
import FemaleFunctionChart from '@/components/FemaleFunctionChart.vue'
import { buildLinePoints, buildRadialOffset, buildRadarPoints } from '@/utils/chartGeometry.js'
import { scoreAppearance, scoreStyle } from '@/utils/scoreColor.js'

const props = defineProps({ system: { type: Object, required: true } })
const emit = defineEmits(['indicator-click'])
const viz = computed(() => props.system.visualization)
const linePoints = computed(() => buildLinePoints(viz.value.series ?? []))
const linePath = computed(() => linePoints.value.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '))
const radarPoints = computed(() => buildRadarPoints(viz.value.series ?? []).map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '))
const networkNodes = computed(() => {
  const count = Math.min(viz.value.categories?.length ?? 0, viz.value.series?.length ?? 0)
  return Array.from({ length: count }, (_, index) => {
    const angle = (index * 2 * Math.PI) / count
    return [100 + 76 * Math.sin(angle), 100 - 76 * Math.cos(angle)]
  })
})
const networkOutline = computed(() => networkNodes.value.map(([x, y]) => `${x},${y}`).join(' '))
const indicatorItems = computed(() => (viz.value.categories ?? []).map((name, index) => {
  const indicator = props.system.indicators?.find(item => item.name === name)
    ?? props.system.indicators?.[index]
  return {
    name,
    score: viz.value.series?.[index],
    indicator,
  }
}))
const average = computed(() => {
  const values = (viz.value.series ?? []).filter(value => scoreAppearance(value).key !== 'unknown').map(Number)
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
})
</script>

<template>
  <div class="detail-chart" :class="{ 'detail-chart--female': system.id === 'female' }" :data-chart-type="viz.type" :style="scoreStyle(system.score)" :data-score-level="scoreAppearance(system.score).key" :role="system.id === 'female' || ['network', 'horizontal-bars', 'matrix', 'radial-orbit', 'vertical-bars'].includes(viz.type) ? 'group' : 'img'" :aria-label="`${system.name}：${viz.title}，综合活力值 ${system.score ?? '未参与评分'}`">
    <FemaleFunctionChart v-if="system.id === 'female'" :system="system" variant="detail" @indicator-click="emit('indicator-click', $event)" />
    <template v-else-if="viz.type === 'line'">
      <svg class="detail-line-chart" viewBox="0 0 320 168" aria-hidden="true"><path class="detail-chart-grid" d="M18 34H302M18 80H302M18 126H302" /><path class="detail-chart-area" :d="`${linePath}L302 140H18Z`" /><path class="detail-chart-stroke" :d="linePath" /><g v-for="(point, index) in linePoints" :key="index" :style="scoreStyle(viz.series[index])"><circle :cx="point.x" :cy="point.y" r="5" /><text class="score-value" :x="point.x" :y="point.y - 11">{{ viz.series[index] ?? '—' }}</text><text class="axis-label" :x="point.x" y="158">{{ index + 1 }}</text></g></svg>
      <div class="detail-axis-caption"><span>第 1 次</span><span>{{ viz.period }} · {{ viz.unit }}</span><span>第 {{ linePoints.length }} 次</span></div>
    </template>

    <div v-else-if="viz.type === 'radial-gauge'" class="detail-radial-layout">
      <div class="detail-radial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" /><circle class="progress" cx="60" cy="60" r="48" :style="{ strokeDashoffset: buildRadialOffset(viz.value, 302) }" /></svg><strong class="score-value">{{ viz.value ?? '—' }}</strong><span>{{ viz.unit }}</span></div>
      <div v-if="viz.secondary" class="detail-secondary-stat"><span>{{ viz.secondary.name }}</span><strong>{{ viz.secondary.value }}<small>{{ viz.secondary.unit }}</small></strong><i><b :style="{ width: `${viz.secondary.value}%` }"></b></i><p>直接采集结果</p></div>
    </div>

    <div v-else-if="viz.type === 'horizontal-bars'" class="detail-horizontal-bars"><button v-for="(item, index) in indicatorItems" :key="item.indicator?.indicator_code || `${item.name}-${index}`" type="button" class="detail-horizontal-bar-button" :aria-label="`查看${item.name}详情`" :disabled="!item.indicator?.indicator_code" @click="emit('indicator-click', item.indicator)"><article :style="scoreStyle(item.score)"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><label>{{ item.name }}</label><i><b :style="{ width: `${item.score ?? 0}%` }"></b></i></div><strong class="score-value">{{ item.score ?? '—' }}</strong></article></button></div>

    <div v-else-if="viz.type === 'matrix'" class="detail-chart-values"><span v-for="(item, index) in indicatorItems" :key="item.indicator?.indicator_code || `${item.name}-${index}`" :style="scoreStyle(item.score)"><button type="button" class="detail-chart-value-button" :aria-label="`查看${item.name}详情`" :disabled="!item.indicator?.indicator_code" @click="emit('indicator-click', item.indicator)"><small>{{ item.name }}</small><strong class="score-value">{{ item.score ?? '—' }}</strong></button></span></div>

    <template v-else-if="viz.type === 'radial-orbit'">
      <div class="detail-radar-wrap"><svg class="detail-radar" viewBox="0 0 200 200" aria-hidden="true"><g class="web"><polygon points="100,28 168,78 142,158 58,158 32,78" /><polygon points="100,52 145,85 128,138 72,138 55,85" /><path v-for="index in 5" :key="index" :d="`M100 100L${[100,168,142,58,32][index - 1]} ${[28,78,158,158,78][index - 1]}`" /></g><polygon class="shape" :points="radarPoints" /><text class="score-value" x="100" y="96">{{ viz.value ?? '—' }}</text><text class="radar-unit" x="100" y="111">{{ viz.unit }}</text></svg><div class="detail-chart-values"><span v-for="(item, index) in indicatorItems" :key="item.indicator?.indicator_code || `${item.name}-${index}`" :style="scoreStyle(item.score)"><button type="button" class="detail-chart-value-button" :aria-label="`查看${item.name}详情`" :disabled="!item.indicator?.indicator_code" @click="emit('indicator-click', item.indicator)"><small>{{ item.name }}</small><strong class="score-value">{{ item.score ?? '—' }}</strong></button></span></div></div>
    </template>

    <template v-else-if="viz.type === 'network'">
      <div class="detail-network-wrap">
        <svg class="detail-network" viewBox="0 0 200 200" aria-hidden="true">
          <g class="links">
            <path v-for="(node, index) in networkNodes" :key="index" :d="`M100 100L${node[0]} ${node[1]}`" />
            <polygon v-if="networkNodes.length > 2" :points="networkOutline" />
          </g>
          <circle class="center" cx="100" cy="100" r="31" :style="scoreStyle(average)" />
          <circle v-for="(node, index) in networkNodes" :key="index" :cx="node[0]" :cy="node[1]" r="13" :style="scoreStyle(viz.series[index])" />
          <text class="network-score score-value" x="100" y="105" :style="scoreStyle(average)">{{ average ?? '—' }}</text>
        </svg>
        <div class="detail-network-values">
          <button
            v-for="(item, index) in indicatorItems"
            :key="item.indicator?.indicator_code || `${item.name}-${index}`"
            type="button"
            class="detail-network-item"
            :style="scoreStyle(item.score)"
            :aria-label="`查看${item.name}详情`"
            :disabled="!item.indicator?.indicator_code"
            @click="emit('indicator-click', item.indicator)"
          >
            <span class="detail-network-item-head"><span>{{ item.name }}</span><strong class="score-value">{{ item.score ?? '—' }}</strong></span>
            <i><b :style="{ width: `${item.score ?? 0}%` }"></b></i>
          </button>
        </div>
      </div>
    </template>

    <div v-else-if="viz.type === 'vertical-bars'" class="detail-vertical-bars"><button v-for="(item, index) in indicatorItems" :key="item.indicator?.indicator_code || `${item.name}-${index}`" type="button" class="detail-vertical-bar-button" :aria-label="`查看${item.name}详情`" :disabled="!item.indicator?.indicator_code" @click="emit('indicator-click', item.indicator)"><article :style="scoreStyle(item.score)"><strong class="score-value">{{ item.score ?? '—' }}</strong><i><b :style="{ height: `${item.score ?? 0}%` }"></b></i><span>{{ item.name }}</span></article></button></div>
    <div v-else class="empty-module">该模块图表数据暂未生成。</div>
  </div>
</template>

<style scoped>
.detail-chart[data-chart-type='matrix'] {
  min-height: 0;
}

.detail-chart[data-chart-type='matrix'] .detail-chart-values {
  margin-top: 0;
}

.detail-chart.detail-chart--female {
  min-height: 0;
  padding: 16px;
}

.detail-network-item {
  display: block;
  width: 100%;
  appearance: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.detail-network-item:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(38, 157, 164, .4);
  box-shadow: 0 5px 14px rgba(35, 92, 113, .1);
}

.detail-network-item:focus-visible {
  outline: 3px solid rgba(38, 157, 164, .5);
  outline-offset: 2px;
}

.detail-network-item:disabled {
  cursor: default;
}

.detail-chart-value-button {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.detail-chart-value-button:focus-visible,
.detail-horizontal-bar-button:focus-visible,
.detail-vertical-bar-button:focus-visible {
  outline: 3px solid rgba(38, 157, 164, .5);
  outline-offset: 2px;
}

.detail-chart-value-button:disabled,
.detail-horizontal-bar-button:disabled,
.detail-vertical-bar-button:disabled {
  cursor: default;
}

.detail-horizontal-bar-button {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  border-bottom: 1px solid rgba(58, 84, 121, .08);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.detail-horizontal-bar-button:last-child {
  border-bottom: 0;
}

.detail-horizontal-bar-button article {
  border-bottom: 0;
}

.detail-vertical-bar-button {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.detail-chart-value-button:hover:not(:disabled) {
  filter: brightness(.97);
}

.detail-horizontal-bar-button:hover:not(:disabled),
.detail-vertical-bar-button:hover:not(:disabled) {
  filter: brightness(.97);
}
</style>
