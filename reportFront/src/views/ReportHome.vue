<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { ReportApiError, fetchReportHome, reportParamsFromLocation, reportRouteQueryFromLocation } from '@/api/reportClient.js'
import { toReportViewModel } from '@/data/reportAdapter.js'
import { reportAssets } from '@/data/report.js'
import { restoreHomeScroll, saveHomeScroll } from '@/composables/useScrollRestoration.js'
import AiConsultEntry from '@/components/AiConsultEntry.vue'
import ReportHomeSkeleton from '@/components/ReportHomeSkeleton.vue'
import ReportProfile from '@/components/ReportProfile.vue'
import ReportErrorState from '@/components/ReportErrorState.vue'
import ScoreOverview from '@/components/ScoreOverview.vue'
import SystemAtlas from '@/components/SystemAtlas.vue'

// 报告自带的静态资源（医生头像、咨询设计稿、可下载长图）。
// 这些不是业务数据，接口不返回（FR-004 的同一原则）。
const ASSETS = reportAssets

const state = ref('loading')
const errorKind = ref('')
const report = ref(null)
const aiConsultRoute = computed(() => ({
  name: 'ai-consult',
  query: reportRouteQueryFromLocation(),
}))

async function load() {
  const { reportCode, customerId } = reportParamsFromLocation()
  if (!reportCode || customerId === null) {
    state.value = 'error'
    errorKind.value = 'not_found'
    return
  }
  state.value = 'loading'
  try {
    const dto = await fetchReportHome(reportCode, customerId)
    report.value = toReportViewModel(dto, { assets: ASSETS })
    state.value = 'ready'
    await nextTick()
    await restoreHomeScroll()
  } catch (error) {
    errorKind.value = error instanceof ReportApiError ? error.kind : 'network'
    state.value = 'error'
  }
}

onMounted(load)
</script>

<template>
  <ReportHomeSkeleton v-if="state === 'loading'" />
  <ReportErrorState v-else-if="state !== 'ready'" :kind="errorKind" />
  <main v-else class="app-shell report-v2" data-testid="report-home">
    <ScoreOverview :report="report" />
    <ReportProfile :report="report" />
    <AiConsultEntry
      v-if="report.aiConsult?.enabled"
      :to="aiConsultRoute"
      :avatar="report.assets.aiDoctorAvatar"
      :title="report.aiConsult.title"
      @navigate="saveHomeScroll"
    />
    <SystemAtlas :report="report" />
    <footer>
      <p>本报告用于健康趋势展示，不替代医学诊断或治疗建议。</p>
    </footer>
  </main>
</template>

<style scoped>
.report-v2 footer {
  justify-content: center;
  text-align: center;
}
</style>
