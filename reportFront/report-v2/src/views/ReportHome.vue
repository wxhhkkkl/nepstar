<script setup>
import { reportSnapshot } from '@/data/report.js'
import { useHomeScrollRestoration } from '@/composables/useScrollRestoration.js'
import AiConsultEntry from '@/components/AiConsultEntry.vue'
import ReportProfile from '@/components/ReportProfile.vue'
import ScoreOverview from '@/components/ScoreOverview.vue'
import SystemAtlas from '@/components/SystemAtlas.vue'

useHomeScrollRestoration()
</script>

<template>
  <main class="app-shell report-v2" data-testid="report-home">
    <ScoreOverview :report="reportSnapshot" />
    <ReportProfile :report="reportSnapshot" />
    <AiConsultEntry :href="reportSnapshot.assets.aiConsultImage" :avatar="reportSnapshot.assets.aiDoctorAvatar" />
    <SystemAtlas :report="reportSnapshot" />
    <footer><p>本报告用于健康趋势展示，不替代医学诊断或治疗建议。</p><span>{{ reportSnapshot.serialNumber }}</span></footer>
  </main>
</template>
