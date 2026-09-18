<script setup>
import { computed } from 'vue'
import { useScoreAnimation } from '@/composables/useScoreAnimation.js'
import { isWarningScore } from '@/utils/report.js'
import SaveReportButton from './SaveReportButton.vue'

const props = defineProps({ report: { type: Object, required: true } })
// 由接口的功能开关控制，前端不内置（FR-020）
const showSaveReport = computed(() => props.report.features?.save_report_enabled === true)
const warning = computed(() => isWarningScore(props.report))
const ageDifference = computed(() => (props.report.biologicalAge - props.report.actualAge).toFixed(1))
const { displayScore, run } = useScoreAnimation(props.report.score)
</script>

<template>
  <section id="scorePanel" class="score-panel" :class="{ 'is-warning-score': warning, 'is-animated': true }" :aria-label="`长寿指数${report.score}分，${warning ? '建议关注' : '状态良好'}`">
    <div class="score-noise"></div>
    <div class="score-meta">
      <span>REPORT / {{ report.reportDate }}</span>
      <SaveReportButton v-if="showSaveReport" :href="report.assets.downloadImage" />
    </div>
    <div class="score-stage">
      <svg class="score-rings" viewBox="0 0 320 320" aria-hidden="true">
        <defs><linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38C6FF" /><stop offset=".55" stop-color="#2764FF" /><stop offset="1" stop-color="#6C36E8" /></linearGradient></defs>
        <circle class="ring-track" cx="160" cy="160" r="132" /><circle class="ring-progress" cx="160" cy="160" r="132" /><circle class="ring-fine" cx="160" cy="160" r="108" /><path class="ring-dash" d="M52 160a108 108 0 0 1 216 0" />
      </svg>
      <div class="orbit orbit-a"><i></i></div><div class="orbit orbit-b"><i></i></div>
      <div class="score-core"><span>LONGEVITY</span><div><strong id="scoreValue" :data-score="report.score">{{ displayScore }}</strong><small>分</small></div><em>{{ warning ? '建议关注' : '状态良好' }}</em></div>
      <div class="scan-beam"></div>
    </div>
    <div class="score-foot">
      <div><span>超过同龄人</span><strong>{{ report.peerPercent }}<small>%</small></strong></div>
      <div><span>生理年龄差</span><strong>+{{ ageDifference }}<small>岁</small></strong></div>
      <button id="replayScore" class="replay-button" type="button" aria-label="重播长寿指数动效" @click="run"><svg viewBox="0 0 24 24"><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 0-2 5" /></svg><span>重播动效</span></button>
    </div>
  </section>
</template>
