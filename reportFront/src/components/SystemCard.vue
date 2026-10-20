<script setup>
import { computed } from 'vue'
import FemaleFunctionChart from '@/components/FemaleFunctionChart.vue'
import LungOverview from '@/components/LungOverview.vue'
import { saveHomeScroll, shouldRestoreHomeScroll } from '@/composables/useScrollRestoration.js'
import { useCardReveal } from '@/composables/useCardReveal.js'
import { reportRouteQueryFromLocation } from '@/api/reportClient.js'
import { indicatorProgressColor } from '@/utils/indicatorColor.js'

const props = defineProps({
  system: { type: Object, required: true },
  displayIndex: { type: Number, default: 1 },
})
// 返回首页时直接展示卡片，避免滚动恢复后仍等待入场动画的视口回调。
const { element, isVisible } = useCardReveal({ initiallyVisible: shouldRestoreHomeScroll() })
const reportQuery = reportRouteQueryFromLocation()
const indexLabel = computed(() => String(props.displayIndex).padStart(2, '0'))
</script>

<template>
  <RouterLink ref="element" :to="{ name: 'system-detail', params: { systemId: system.systemCode }, query: reportQuery }" class="data-card" :class="[`${system.id}-card`, { 'is-visible': isVisible }]" :data-system-id="system.id" :aria-label="`查看${system.name}详情`" @click="saveHomeScroll">
    <template v-if="system.id === 'cardio'">
      <div class="card-index">{{ indexLabel }} / CARDIO</div><div class="card-head"><div><h3>{{ system.name }}</h3><p>稳定而有弹性的循环系统</p></div><strong>{{ system.score }}</strong></div>
      <svg class="cardio-chart" viewBox="0 0 330 120" role="img" aria-label="心血管近六次活力值上升趋势"><defs><linearGradient id="cardioArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#42C7FF" stop-opacity=".38" /><stop offset="1" stop-color="#42C7FF" stop-opacity="0" /></linearGradient></defs><path class="chart-grid" d="M0 24H330M0 60H330M0 96H330" /><path class="chart-area" d="M0 90C40 86 46 60 83 67s50 22 82 2 45-14 69-4 52-12 96-43v98H0Z" /><path class="chart-line" d="M0 90C40 86 46 60 83 67s50 22 82 2 45-14 69-4 52-12 96-43" /><circle cx="330" cy="22" r="5" /></svg>
      <div class="stat-row"><span v-for="tag in system.tags" :key="tag"><small>{{ tag.split(' ')[0] }}</small>{{ tag.split(' ')[1] }}</span><span class="arrow-pill">查看详情 →</span></div>
    </template>

    <template v-else-if="system.id === 'lung'">
      <LungOverview :system="system" :index-label="indexLabel" />
      <p>肺活量良好 · 睡眠呼吸可提升</p>
    </template>

    <template v-else-if="system.id === 'endocrine'">
      <div class="card-index">{{ indexLabel }} / ENDO</div>
      <div class="card-mini-head"><h3>{{ system.name }}</h3><strong>{{ system.score }}</strong></div>
      <div class="endo-matrix">
        <span v-for="(name, itemIndex) in system.visualization.categories" :key="name" :style="{ '--v': (system.visualization.series[itemIndex] ?? 0) / 100 }">
          <b class="endo-metric-name">{{ name }}</b>
          <strong class="endo-metric-score">{{ system.visualization.series[itemIndex] ?? '—' }}</strong>
          <i aria-hidden="true"></i>
        </span>
      </div>
      <div class="endo-note"><i></i><span>松果体节律与睡眠是当前改善重点</span></div>
    </template>

    <template v-else-if="system.id === 'digest'">
      <div class="digest-copy"><div class="card-index">{{ indexLabel }} / DIGESTION</div><h3>{{ system.name }}</h3><p>五项指标沿消化链路依次展开，整体吸收效率良好。</p><strong>{{ system.score }}<small>活力值</small></strong></div><div class="digest-flow" aria-label="消化系统五项指标流程"><div v-for="(name, itemIndex) in system.visualization.categories" :key="name"><span>{{ String(itemIndex + 1).padStart(2, '0') }}</span><i :style="{ '--w': `${system.visualization.series[itemIndex]}%`, '--score-color': indicatorProgressColor(itemIndex) }"></i><b>{{ name }} {{ system.visualization.series[itemIndex] }}</b></div></div>
    </template>

    <template v-else-if="system.id === 'female'">
      <div class="card-index">{{ indexLabel }} / FEMALE</div>
      <div class="card-mini-head">
        <div><h3>{{ system.name }}</h3><p>周期与内分泌专项</p></div>
        <strong>{{ system.score ?? '—' }}</strong>
      </div>
      <FemaleFunctionChart :system="system" />
    </template>

    <template v-else-if="system.id === 'male'">
      <div class="card-index">{{ indexLabel }} / MALE</div>
      <div class="card-mini-head"><div><h3>{{ system.name }}</h3><p>男性专项功能</p></div><strong>{{ system.score }}</strong></div>
      <div class="male-metric-list" aria-label="男性功能子级指标">
        <div v-for="item in system.indicators" :key="item.indicator_code || item.name" class="male-metric-item">
          <div><span>{{ item.name }}</span><strong>{{ item.score ?? '—' }}</strong></div>
          <i><b :style="{ width: `${item.score ?? 0}%` }" /></i>
        </div>
      </div>
    </template>

    <template v-else-if="system.id === 'immune'">
      <div class="immune-copy"><div class="card-index">{{ indexLabel }} / IMMUNITY</div><h3>{{ system.name }}</h3><strong>{{ system.score }}</strong><span>本次优势维度</span><p>六个免疫节点保持均衡，形成稳定防御网络。</p></div><div class="immune-map" aria-label="六项免疫指标点阵图"><svg viewBox="0 0 210 210"><path class="network" d="M105 35 166 70 164 139 105 175 45 140 44 70Z M105 35 105 105 166 70M105 105 164 139M105 105 105 175M105 105 45 140M105 105 44 70" /><circle cx="105" cy="105" r="28" /><circle cx="105" cy="35" r="9" /><circle cx="166" cy="70" r="8" /><circle cx="164" cy="139" r="9" /><circle cx="105" cy="175" r="8" /><circle cx="45" cy="140" r="9" /><circle cx="44" cy="70" r="8" /></svg><span class="map-center">{{ system.score }}</span></div>
    </template>

    <template v-else-if="system.id === 'bone'">
      <div class="card-index">{{ indexLabel }} / BONE</div><div class="bone-head"><div><h3>{{ system.name }}</h3><p>骨质疏松与钙流失管理优先</p></div><strong>{{ system.score }}</strong></div><div class="density-scale"><div class="scale-axis"><span>100</span><span>90</span><span>80</span><span>70</span><span>60</span></div><div class="bone-bars"><span v-for="(name, itemIndex) in system.visualization.categories" :key="name" :style="{ '--h': `${system.visualization.series[itemIndex]}%` }"><i>{{ system.visualization.series[itemIndex] }}</i><b :aria-label="name">{{ name.slice(0, 2) }}</b></span></div></div><div class="bone-tip"><span>PRIORITY</span>未来 90 天优先改善</div>
    </template>
  </RouterLink>
</template>

<style scoped>
.data-card {
  border: 1px solid #d2dce8;
  border-radius: 24px;
  box-shadow: 0 6px 20px rgba(44, 67, 103, .07), 0 1px 3px rgba(44, 67, 103, .04);
}

.data-card:active {
  border-color: #a9bbd2;
  box-shadow: 0 3px 10px rgba(44, 67, 103, .08);
}

.data-card:focus-visible {
  outline: 2px solid #4269d8;
  outline-offset: 3px;
}

.data-card.female-card {
  min-height: 0;
}

.data-card.lung-card {
  min-height: 0;
  background: #fff;
}

.data-card.endocrine-card {
  min-height: 0;
  height: auto;
  align-self: start;
}

.data-card.endocrine-card .endo-matrix {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 10px;
}

.data-card.endocrine-card .endo-matrix>span {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: auto;
  min-height: 88px;
}

.endo-metric-name,
.endo-metric-score {
  position: relative;
  z-index: 1;
  display: block;
}

.endo-metric-name {
  font-weight: 500;
}

.endo-metric-score {
  margin-top: 8px;
  color: #53689c;
  font: 700 24px/1 var(--font-report-number);
  font-variant-numeric: tabular-nums;
}

.data-card.endocrine-card .endo-note {
  align-items: center;
}

.data-card.endocrine-card .endo-note>i {
  flex: 0 0 6px;
}

</style>
