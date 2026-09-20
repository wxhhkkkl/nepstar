<script setup>
import { computed, nextTick, onMounted, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { ReportApiError, fetchSystemDetail, reportParamsFromLocation, reportRouteQueryFromLocation } from '@/api/reportClient.js'
import { toSystemViewModel } from '@/data/reportAdapter.js'
import DetailChart from '@/components/DetailChart.vue'
import RecommendationCard from '@/components/RecommendationCard.vue'
import ReportErrorState from '@/components/ReportErrorState.vue'
import SystemDetailSkeleton from '@/components/SystemDetailSkeleton.vue'
import { restoreSystemDetailScroll, saveSystemDetailScroll } from '@/composables/useScrollRestoration.js'

const props = defineProps({ systemId: { type: String, default: '' } })
const route = props.systemId ? null : useRoute()
const currentId = computed(() => props.systemId || route?.params.systemId || '')
const legacySystemCodes = {
  cardio: 'SYS_CARDIO', lung: 'SYS_LUNG', digest: 'SYS_DIGEST', endocrine: 'SYS_ENDOCRINE',
  female: 'SYS_FEMALE', male: 'SYS_MALE', immune: 'SYS_IMMUNE', bone: 'SYS_BONE',
}
const currentSystemCode = computed(() => legacySystemCodes[currentId.value] || currentId.value)
const reportQuery = reportRouteQueryFromLocation()

const state = ref('loading')
const errorKind = ref('')
const system = ref(null)

async function load() {
  const { reportCode, customerId } = reportParamsFromLocation()
  if (!reportCode || customerId === null) {
    errorKind.value = 'not_found'
    state.value = 'error'
    return
  }
  state.value = 'loading'
  try {
    const dto = await fetchSystemDetail(reportCode, currentSystemCode.value, customerId)
    system.value = toSystemViewModel(dto.system)
    state.value = 'ready'
    await nextTick()
    await restoreSystemDetailScroll(reportCode, currentSystemCode.value)
  } catch (error) {
    errorKind.value = error instanceof ReportApiError ? error.kind : 'network'
    state.value = 'error'
  }
}

function rememberIndicatorPosition() {
  const { reportCode } = reportParamsFromLocation()
  saveSystemDetailScroll(reportCode, currentSystemCode.value)
}

onMounted(load)

watchEffect(() => {
  if (typeof document !== 'undefined') {
    document.title = system.value ? `${system.value.name}详情｜长寿指数` : '系统详情｜长寿指数'
  }
})
</script>

<template>
  <SystemDetailSkeleton v-if="state === 'loading'" />
  <ReportErrorState v-else-if="state !== 'ready'" :kind="errorKind" />

  <main v-else class="app-shell detail-v2" :data-system-id="system.id">
    <header class="top-nav detail-nav"><RouterLink class="round-button" :to="{ name: 'home', query: reportQuery }" aria-label="返回长寿指数报告"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg></RouterLink><div class="brand"><strong>{{ system.name }}详情</strong></div></header>
    <section class="detail-score-block"><div class="detail-score-identity"><div class="detail-module-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><template v-if="system.icon === 'heart'"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /><path d="M4 12h4l1.4-3 2.2 6 1.5-3H20" /></template><template v-else-if="system.icon === 'lungs'"><path d="M12 4v8" /><path d="M10 12c-1-3-2-5-3.5-5S3 10 3 15s3 5 7 3V12Z" /><path d="M14 12c1-3 2-5 3.5-5S21 10 21 15s-3 5-7 3V12Z" /></template><template v-else-if="system.icon === 'bone'"><path d="M6.2 9.2a3 3 0 1 1-3.4-4.8A3 3 0 1 1 7.6 1l8.8 8.8a3 3 0 1 1 4.8 3.4 3 3 0 1 1-3.4 4.8L9 9.2a3 3 0 0 1-2.8 0Z" /></template><template v-else><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" /><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" /></template></svg></div><div><span v-if="system.status">{{ system.status }}</span><h1>{{ system.name }}</h1><p v-if="system.summary">{{ system.summary }}</p></div></div><strong>{{ system.score ?? '—' }}</strong></section>
    <section v-if="!['lung', 'digest'].includes(system.id)" class="detail-visualization" :aria-labelledby="`${system.id}ChartTitle`"><div class="detail-viz-head"><div><span class="eyebrow">INHERITED DATA VIEW</span><h2 :id="`${system.id}ChartTitle`">{{ system.visualization.title }}</h2></div><span>{{ system.visualization.period ? `${system.visualization.period} · ${system.visualization.unit}` : `当前报告 · ${system.visualization.unit}` }}</span></div><DetailChart :system="system" /></section>
    <section class="detail-editorial"><span class="eyebrow">SCORE STRUCTURE</span><div class="section-heading"><h2>评分构成</h2><span>满分 100</span></div><div class="detail-indicator-list"><RouterLink v-for="(item, index) in system.indicators" :key="item.indicator_code" class="detail-indicator-link" :data-indicator-code="item.indicator_code" :to="{ name: 'indicator-detail', params: { systemId: currentSystemCode, indicatorCode: item.indicator_code }, query: reportQuery }" :aria-label="`查看${item.name}详情`" @click="rememberIndicatorPosition"><article><span class="indicator-no">{{ String(index + 1).padStart(2, '0') }}</span><div><h3>{{ item.name }}</h3><small>权重 {{ item.weight }}%</small><i><b :style="{ width: `${item.score}%` }"></b></i></div><strong>{{ item.score }}</strong></article></RouterLink></div></section>
    <RecommendationCard :system="system" variant="detail" />
    <section v-if="system.direct.length" id="directBlock" class="detail-editorial"><span class="eyebrow">LIVE MEASUREMENT</span><div class="section-heading"><h2>直接采集</h2><span>不参与加权</span></div><div class="detail-direct-list"><article v-for="item in system.direct" :key="item.name"><span>{{ item.name }}</span><strong>{{ item.value }}<small v-if="item.unit">{{ item.unit }}</small></strong><small>采集结果</small></article></div></section>
    <section v-if="system.interpretation || system.actions.length" class="detail-conclusion"><span class="eyebrow">INTERPRETATION</span><h2>行动建议</h2><p v-if="system.interpretation">{{ system.interpretation }}</p><ul v-if="system.actions.length"><li v-for="item in system.actions" :key="item"><span>↗</span>{{ item }}</li></ul></section>
    <RouterLink class="detail-back" :to="{ name: 'home', query: reportQuery }">返回长寿指数报告 <span>→</span></RouterLink>
    <footer><p>结果仅用于健康趋势管理，不构成临床诊断。</p></footer>
  </main>
</template>
