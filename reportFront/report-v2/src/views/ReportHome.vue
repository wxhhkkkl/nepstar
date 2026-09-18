<script setup>
import { onMounted, ref } from 'vue'
import { ReportApiError, fetchReportHome, reportParamsFromLocation } from '@/api/reportClient.js'
import { toReportViewModel } from '@/data/reportAdapter.js'
import { useHomeScrollRestoration } from '@/composables/useScrollRestoration.js'
import AiConsultEntry from '@/components/AiConsultEntry.vue'
import ReportProfile from '@/components/ReportProfile.vue'
import ReportErrorState from '@/components/ReportErrorState.vue'
import ScoreOverview from '@/components/ScoreOverview.vue'
import SystemAtlas from '@/components/SystemAtlas.vue'

// 报告自带的静态资源（医生头像、咨询设计稿、可下载长图）。
// 这些不是业务数据，接口不返回（FR-004 的同一原则）。
const ASSETS = {
  aiConsultImage: './AI长寿咨询聊天页设计稿.png',
  aiDoctorAvatar: './AI长寿咨询-卡通医生形象.png',
  downloadImage: './长寿指数报告V2_手机长图.png',
}

const state = ref('loading')
const errorKind = ref('')
const report = ref(null)

useHomeScrollRestoration()

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
  } catch (error) {
    errorKind.value = error instanceof ReportApiError ? error.kind : 'network'
    state.value = 'error'
  }
}

onMounted(load)
</script>

<template>
  <ReportErrorState v-if="state !== 'ready'" :loading="state === 'loading'" :kind="errorKind" />
  <main v-else class="app-shell report-v2" data-testid="report-home">
    <ScoreOverview :report="report" />
    <ReportProfile :report="report" />
    <AiConsultEntry
      v-if="report.aiConsult?.enabled"
      :href="report.aiConsult.entry_url || report.assets.aiConsultImage"
      :avatar="report.assets.aiDoctorAvatar"
      :title="report.aiConsult.title"
    />
    <SystemAtlas :report="report" />
    <footer>
      <p>本报告用于健康趋势展示，不替代医学诊断或治疗建议。</p>
      <span>{{ report.serialNumber }}</span>
    </footer>
  </main>
</template>
