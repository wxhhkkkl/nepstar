<script setup>
import { computed } from 'vue'
import { buildLinePoints, buildRadialOffset, buildRadarPoints } from '@/utils/chartGeometry.js'

const props = defineProps({ system: { type: Object, required: true } })
const viz = computed(() => props.system.visualization)
const linePoints = computed(() => buildLinePoints(viz.value.series ?? []))
const linePath = computed(() => linePoints.value.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '))
const radarPoints = computed(() => buildRadarPoints(viz.value.series ?? []).map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '))
const networkNodes = [[100, 24], [165, 62], [165, 138], [100, 176], [35, 138], [35, 62]]
const average = computed(() => {
  const values = viz.value.series ?? []
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
})
</script>

<template>
  <div class="detail-chart" :data-chart-type="viz.type" role="img" :aria-label="`${system.name}：${viz.title}，综合活力值 ${system.score ?? '未参与评分'}`">
    <template v-if="viz.type === 'line'">
      <svg class="detail-line-chart" viewBox="0 0 320 168" aria-hidden="true"><path class="detail-chart-grid" d="M18 34H302M18 80H302M18 126H302" /><path class="detail-chart-area" :d="`${linePath}L302 140H18Z`" /><path class="detail-chart-stroke" :d="linePath" /><g v-for="(point, index) in linePoints" :key="index"><circle :cx="point.x" :cy="point.y" r="5" /><text :x="point.x" :y="point.y - 11">{{ point.value }}</text><text class="axis-label" :x="point.x" y="158">{{ index + 1 }}</text></g></svg>
      <div class="detail-axis-caption"><span>第 1 次</span><span>{{ viz.period }} · {{ viz.unit }}</span><span>第 {{ linePoints.length }} 次</span></div>
    </template>

    <div v-else-if="viz.type === 'radial-gauge'" class="detail-radial-layout">
      <div class="detail-radial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" /><circle class="progress" cx="60" cy="60" r="48" :style="{ strokeDashoffset: buildRadialOffset(viz.value, 302) }" /></svg><strong>{{ viz.value }}</strong><span>{{ viz.unit }}</span></div>
      <div v-if="viz.secondary" class="detail-secondary-stat"><span>{{ viz.secondary.name }}</span><strong>{{ viz.secondary.value }}<small>{{ viz.secondary.unit }}</small></strong><i><b :style="{ width: `${viz.secondary.value}%` }"></b></i><p>直接采集结果</p></div>
    </div>

    <div v-else-if="viz.type === 'horizontal-bars'" class="detail-horizontal-bars"><article v-for="(name, index) in viz.categories" :key="name"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><label>{{ name }}</label><i><b :style="{ width: `${viz.series[index]}%` }"></b></i></div><strong>{{ viz.series[index] }}</strong></article></div>

    <template v-else-if="viz.type === 'matrix'">
      <div class="detail-matrix"><article v-for="(name, index) in viz.categories" :key="name"><span>{{ name }}</span><strong>{{ viz.series[index] }}</strong><i :style="{ '--level': viz.series[index] / 100 }"></i></article></div>
      <div class="detail-chart-values"><span v-for="(name, index) in viz.categories" :key="name"><small>{{ name }}</small><strong>{{ viz.series[index] }}</strong></span></div>
    </template>

    <template v-else-if="viz.type === 'radial-orbit'">
      <div class="detail-radar-wrap"><svg class="detail-radar" viewBox="0 0 200 200" aria-hidden="true"><g class="web"><polygon points="100,28 168,78 142,158 58,158 32,78" /><polygon points="100,52 145,85 128,138 72,138 55,85" /><path v-for="index in 5" :key="index" :d="`M100 100L${[100,168,142,58,32][index - 1]} ${[28,78,158,158,78][index - 1]}`" /></g><polygon class="shape" :points="radarPoints" /><text x="100" y="96">{{ viz.value || average }}</text><text class="radar-unit" x="100" y="111">{{ viz.unit }}</text></svg><div class="detail-chart-values"><span v-for="(name, index) in viz.categories" :key="name"><small>{{ name }}</small><strong>{{ viz.series[index] }}</strong></span></div></div>
    </template>

    <template v-else-if="viz.type === 'network'">
      <div class="detail-network-wrap"><svg class="detail-network" viewBox="0 0 200 200" aria-hidden="true"><g class="links"><path v-for="node in networkNodes" :key="node.join('-')" :d="`M100 100L${node[0]} ${node[1]}`" /><path d="M100 24L165 62L165 138L100 176L35 138L35 62Z" /></g><circle class="center" cx="100" cy="100" r="31" /><g v-for="(node, index) in networkNodes" :key="index"><circle :cx="node[0]" :cy="node[1]" r="13" /><text :x="node[0]" :y="node[1] + 3">{{ viz.series[index] }}</text></g><text class="network-score" x="100" y="105">{{ average }}</text></svg><div class="detail-chart-values"><span v-for="(name, index) in viz.categories" :key="name"><small>{{ name }}</small><strong>{{ viz.series[index] }}</strong></span></div></div>
    </template>

    <div v-else-if="viz.type === 'vertical-bars'" class="detail-vertical-bars"><article v-for="(name, index) in viz.categories" :key="name"><strong>{{ viz.series[index] }}</strong><i><b :style="{ height: `${viz.series[index]}%` }"></b></i><span>{{ name }}</span></article></div>
    <div v-else class="empty-module">该模块图表数据暂未生成。</div>
  </div>
</template>
