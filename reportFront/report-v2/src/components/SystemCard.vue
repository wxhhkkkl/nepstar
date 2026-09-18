<script setup>
import { saveHomeScroll } from '@/composables/useScrollRestoration.js'
import { useCardReveal } from '@/composables/useCardReveal.js'

const props = defineProps({ system: { type: Object, required: true } })
const { element, isVisible } = useCardReveal()
const legacyIndexes = { cardio: '01', lung: '02', digest: '03', endocrine: '04', female: '05', immune: '07', bone: '08' }
const indexLabel = legacyIndexes[props.system.id] ?? '00'
</script>

<template>
  <RouterLink ref="element" :to="{ name: 'system-detail', params: { systemId: system.id } }" class="data-card" :class="[`${system.id}-card`, { 'is-visible': isVisible }]" :data-system-id="system.id" :aria-label="`查看${system.name}详情`" @click="saveHomeScroll">
    <template v-if="system.id === 'cardio'">
      <div class="card-index">{{ indexLabel }} / CARDIO</div><div class="card-head"><div><h3>{{ system.name }}</h3><p>稳定而有弹性的循环系统</p></div><strong>{{ system.score }}</strong></div>
      <svg class="cardio-chart" viewBox="0 0 330 120" role="img" aria-label="心血管近六次活力值上升趋势"><defs><linearGradient id="cardioArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#42C7FF" stop-opacity=".38" /><stop offset="1" stop-color="#42C7FF" stop-opacity="0" /></linearGradient></defs><path class="chart-grid" d="M0 24H330M0 60H330M0 96H330" /><path class="chart-area" d="M0 90C40 86 46 60 83 67s50 22 82 2 45-14 69-4 52-12 96-43v98H0Z" /><path class="chart-line" d="M0 90C40 86 46 60 83 67s50 22 82 2 45-14 69-4 52-12 96-43" /><circle cx="330" cy="22" r="5" /></svg>
      <div class="stat-row"><span v-for="tag in system.tags" :key="tag"><small>{{ tag.split(' ')[0] }}</small>{{ tag.split(' ')[1] }}</span><span class="arrow-pill">查看详情 →</span></div>
    </template>

    <template v-else-if="system.id === 'lung'">
      <div class="card-index">{{ indexLabel }} / LUNG</div><h3>{{ system.name }}</h3><div class="lung-gauge"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="47" /><circle class="lung-progress" cx="60" cy="60" r="47" /></svg><strong>{{ system.score }}</strong><span>活力值</span></div><div class="oxygen"><span>血氧饱和度</span><strong>98%</strong><i></i></div><p>肺活量良好 · 睡眠呼吸可提升</p>
    </template>

    <template v-else-if="system.id === 'endocrine'">
      <div class="card-index">{{ indexLabel }} / ENDO</div><div class="card-mini-head"><h3>{{ system.name }}</h3><strong>{{ system.score }}</strong></div><div class="endo-matrix"><span v-for="(name, itemIndex) in system.visualization.categories" :key="name" :style="{ '--v': system.visualization.series[itemIndex] / 100 }">{{ name }}<i></i></span></div><div class="endo-note"><i></i><span>松果体节律与睡眠<br>是当前改善重点</span></div>
    </template>

    <template v-else-if="system.id === 'digest'">
      <div class="digest-copy"><div class="card-index">{{ indexLabel }} / DIGESTION</div><h3>{{ system.name }}</h3><p>五项指标沿消化链路依次展开，整体吸收效率良好。</p><strong>{{ system.score }}<small>活力值</small></strong></div><div class="digest-flow" aria-label="消化系统五项指标流程"><div v-for="(name, itemIndex) in system.visualization.categories" :key="name"><span>{{ String(itemIndex + 1).padStart(2, '0') }}</span><i :style="{ '--w': `${system.visualization.series[itemIndex]}%` }"></i><b>{{ name }} {{ system.visualization.series[itemIndex] }}</b></div></div>
    </template>

    <template v-else-if="system.id === 'female'">
      <div class="card-index">{{ indexLabel }} / FEMALE</div><div class="card-mini-head"><div><h3>{{ system.name }}</h3><p>周期与内分泌专项</p></div><strong>{{ system.score }}</strong></div><div class="cycle-visual" role="img" :aria-label="`${system.visualization.title}：${system.visualization.categories.map((name, index) => `${name}${system.visualization.series[index]}`).join('，')}`"><div class="cycle-orbit" aria-hidden="true"><div class="cycle-center"><span>稳定度</span><strong>{{ system.score }}%</strong></div><i v-for="angle in [0,72,144,216,288]" :key="angle" :style="{ '--a': `${angle}deg` }"></i></div><span v-for="(name, itemIndex) in system.visualization.categories" :key="name" class="cycle-metric" :class="`cycle-metric-${itemIndex + 1}`"><b>{{ name }}</b><em>{{ system.visualization.series[itemIndex] }}</em></span></div>
    </template>

    <template v-else-if="system.id === 'immune'">
      <div class="immune-copy"><div class="card-index">{{ indexLabel }} / IMMUNITY</div><h3>{{ system.name }}</h3><strong>{{ system.score }}</strong><span>本次优势维度</span><p>六个免疫节点保持均衡，形成稳定防御网络。</p></div><div class="immune-map" aria-label="六项免疫指标点阵图"><svg viewBox="0 0 210 210"><path class="network" d="M105 35 166 70 164 139 105 175 45 140 44 70Z M105 35 105 105 166 70M105 105 164 139M105 105 105 175M105 105 45 140M105 105 44 70" /><circle cx="105" cy="105" r="28" /><circle cx="105" cy="35" r="9" /><circle cx="166" cy="70" r="8" /><circle cx="164" cy="139" r="9" /><circle cx="105" cy="175" r="8" /><circle cx="45" cy="140" r="9" /><circle cx="44" cy="70" r="8" /></svg><span class="map-center">{{ system.score }}</span></div>
    </template>

    <template v-else-if="system.id === 'bone'">
      <div class="card-index">{{ indexLabel }} / BONE</div><div class="bone-head"><div><h3>{{ system.name }}</h3><p>骨质疏松与钙流失管理优先</p></div><strong>{{ system.score }}</strong></div><div class="density-scale"><div class="scale-axis"><span>100</span><span>90</span><span>80</span><span>70</span><span>60</span></div><div class="bone-bars"><span v-for="(name, itemIndex) in system.visualization.categories" :key="name" :style="{ '--h': `${system.visualization.series[itemIndex]}%` }"><i>{{ system.visualization.series[itemIndex] }}</i><b>{{ name }}</b></span></div></div><div class="bone-tip"><span>PRIORITY</span>未来 90 天优先改善</div>
    </template>
  </RouterLink>
</template>
