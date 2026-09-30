<script setup>
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import {
  ERROR_KINDS,
  ReportApiError,
  fetchIndicatorDetail,
  reportParamsFromLocation,
  reportRouteQueryFromLocation,
} from '@/api/reportClient.js'
import ReportErrorState from '@/components/ReportErrorState.vue'
import IndicatorDetailSkeleton from '@/components/IndicatorDetailSkeleton.vue'

const props = defineProps({
  systemId: { type: String, default: '' },
  indicatorCode: { type: String, default: '' },
})
const route = props.systemId && props.indicatorCode ? null : useRoute()
const currentSystemCode = computed(() => props.systemId || route?.params.systemId || '')
const currentIndicatorCode = computed(() => props.indicatorCode || route?.params.indicatorCode || '')
const state = ref('loading')
const errorKind = ref('')
const detail = ref(null)
let requestVersion = 0

const reportQuery = computed(() => {
  // Depend on the active route so launch context stays current after navigation.
  route?.fullPath
  return reportRouteQueryFromLocation()
})
const parentSystemCode = computed(() => detail.value?.system?.system_code || currentSystemCode.value)
const parentRoute = computed(() => ({
  name: 'system-detail',
  params: { systemId: parentSystemCode.value },
  query: reportQuery.value,
}))
const errorBackRoute = computed(() => reportQuery.value.reportId ? parentRoute.value : null)
const indicator = computed(() => detail.value?.indicator || null)
const hasActions = computed(() => Boolean(indicator.value?.actions?.length))
const hasInterpretation = computed(() => Boolean(indicator.value?.interpretation))
const hasProfile = computed(() => Boolean(indicator.value?.description || hasInterpretation.value))

const validTrend = computed(() => (indicator.value?.trend || []).filter((point) =>
  point?.score !== null && point?.score !== undefined && point?.date &&
  Number.isFinite(Number(point.score)) && Number(point.score) >= 0 && Number(point.score) <= 100,
))
const chartPoints = computed(() => validTrend.value.map((point, index, all) => ({
  x: 16 + (index * 288) / Math.max(1, all.length - 1),
  y: 105 - Number(point.score) * 0.72,
  score: Number(point.score),
  date: point.date,
})))
const linePath = computed(() => chartPoints.value
  .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
  .join(' '))
const areaPath = computed(() => chartPoints.value.length > 1
  ? `${linePath.value} L ${chartPoints.value.at(-1).x} 112 L ${chartPoints.value[0].x} 112 Z`
  : '')
const scorePercent = computed(() => {
  const value = Number(indicator.value?.score)
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
})

async function load() {
  const version = ++requestVersion
  const { reportCode, customerId } = reportParamsFromLocation()
  if (!reportCode || customerId === null || !currentIndicatorCode.value) {
    errorKind.value = ERROR_KINDS.NOT_FOUND
    state.value = 'error'
    return
  }
  state.value = 'loading'
  detail.value = null
  try {
    const result = await fetchIndicatorDetail(reportCode, currentIndicatorCode.value, customerId)
    if (version !== requestVersion) return
    if (result?.system?.system_code !== currentSystemCode.value ||
      result?.indicator?.indicator_code !== currentIndicatorCode.value) {
      throw new ReportApiError(ERROR_KINDS.INDICATOR_NOT_FOUND)
    }
    detail.value = result
    state.value = 'ready'
  } catch (error) {
    if (version !== requestVersion) return
    errorKind.value = error instanceof ReportApiError ? error.kind : ERROR_KINDS.NETWORK
    state.value = 'error'
  }
}

watch(() => [currentSystemCode.value, currentIndicatorCode.value, route?.fullPath], load, { immediate: true })
watchEffect(() => {
  if (typeof document !== 'undefined') {
    document.title = indicator.value ? `${indicator.value.name}详情｜长寿指数` : '指标详情｜长寿指数'
  }
})
</script>

<template>
  <IndicatorDetailSkeleton v-if="state === 'loading'" />
  <ReportErrorState v-else-if="state !== 'ready'" :kind="errorKind" :back-to="errorBackRoute" back-label="返回系统详情" />

  <main v-else class="app-shell indicator-detail-page" :data-indicator-code="indicator.indicator_code">
    <header class="indicator-detail-nav">
      <RouterLink class="indicator-nav-back" :to="parentRoute" :aria-label="`返回${detail.system.name}详情`">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </RouterLink>
      <strong>{{ indicator.name }}详情</strong>
      <span aria-hidden="true" />
    </header>

    <section class="indicator-hero" aria-labelledby="indicatorTitle">
      <div class="indicator-hero-main">
        <div class="indicator-hero-copy">
          <span class="indicator-system-pill">{{ detail.system.name }} · 单项指标</span>
          <h1 id="indicatorTitle">{{ indicator.name }}</h1>
          <p>本次检测结果</p>
        </div>
        <div class="indicator-ring" role="img" :aria-label="`${indicator.name}活力值${indicator.score ?? '暂无'}分`">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="indicator-ring-track" cx="60" cy="60" r="49" />
            <circle class="indicator-ring-progress" cx="60" cy="60" r="49"
              :style="{ strokeDashoffset: 308 * (1 - scorePercent / 100) }" />
          </svg>
          <div><strong>{{ indicator.score ?? '—' }}</strong><span>活力值</span></div>
        </div>
      </div>
      <div class="indicator-hero-facts">
        <div><span>所属系统</span><strong>{{ detail.system.name }}</strong></div>
        <div><span>本次结果</span><strong :class="{ 'is-good': indicator.status_text === '正常' }">{{ indicator.status_text || '—' }}</strong></div>
        <div><span>评分上限</span><strong>100</strong></div>
      </div>
    </section>

    <section v-if="hasProfile" class="indicator-panel indicator-profile" aria-labelledby="indicatorProfileTitle">
      <span class="eyebrow">INDICATOR PROFILE</span>
      <h2 id="indicatorProfileTitle">指标解读</h2>
      <p v-if="indicator.description">{{ indicator.description }}</p>
      <p v-if="hasInterpretation" class="indicator-interpretation">{{ indicator.interpretation }}</p>
    </section>

    <section class="indicator-panel indicator-history" aria-labelledby="indicatorHistoryTitle">
      <div class="indicator-panel-heading">
        <div><span class="eyebrow">HISTORY TREND</span><h2 id="indicatorHistoryTitle">历史趋势</h2></div>
        <span v-if="validTrend.length > 1">最近 {{ validTrend.length }} 次</span>
      </div>
      <template v-if="validTrend.length > 1">
        <div class="indicator-trend-chart" role="img" :aria-label="`${indicator.name}最近${validTrend.length}次真实检测趋势`">
          <svg viewBox="0 0 320 130" preserveAspectRatio="none" aria-hidden="true">
            <path class="indicator-chart-area" :d="areaPath" />
            <path class="indicator-chart-line" :d="linePath" />
            <g v-for="(point, index) in chartPoints" :key="`${point.date}-${index}`">
              <circle :cx="point.x" :cy="point.y" r="3.8" />
              <text :x="point.x" :y="point.y - 12" text-anchor="middle">{{ point.score }}</text>
            </g>
          </svg>
          <div class="indicator-trend-labels">
            <time v-for="(point, index) in chartPoints" :key="`${point.date}-${index}`" :datetime="point.date">
              <span>{{ point.date.slice(0, 4) }}</span>
              <span>{{ point.date.slice(5) }}</span>
            </time>
          </div>
        </div>
      </template>
      <p v-else class="indicator-first-record">本次为首次有效记录</p>
    </section>

    <section v-if="hasActions" class="indicator-actions" aria-labelledby="indicatorActionsTitle">
      <span class="eyebrow">ACTION PLAN</span>
      <h2 id="indicatorActionsTitle">行动建议</h2>
      <ul>
        <li v-for="(action, index) in indicator.actions" :key="`${index}-${action}`"><span aria-hidden="true">↗</span>{{ action }}</li>
      </ul>
    </section>

    <footer class="indicator-disclaimer">结果仅用于健康趋势管理，不构成临床诊断。</footer>
  </main>
</template>
