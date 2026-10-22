<script setup>
import { computed, ref } from 'vue'
import { useScoreAnimation } from '@/composables/useScoreAnimation.js'
import SaveReportButton from './SaveReportButton.vue'
import ScoreLegend from './ScoreLegend.vue'
import { scoreAppearance, scoreStyle } from '@/utils/scoreColor.js'

const props = defineProps({ report: { type: Object, required: true } })
// 由接口的功能开关控制，前端不内置（FR-020）
const showSaveReport = computed(() => props.report.features?.save_report_enabled === true)
const scoreState = computed(() => scoreAppearance(props.report.score))
const warning = computed(() => scoreState.value.key === 'attention')
const ringOffset = computed(() => 829 * (1 - (scoreState.value.key === 'unknown' ? 0 : Number(props.report.score) / 100)))
const ageDifference = computed(() => (props.report.biologicalAge - props.report.actualAge).toFixed(1))
const { displayScore, run } = useScoreAnimation(props.report.score)
const replayKey = ref(0)

function replay() {
  replayKey.value += 1
  run()
}
</script>

<template>
  <section id="scorePanel" class="score-panel" :style="{ ...scoreStyle(report.score), '--score-offset': ringOffset }" :data-score-level="scoreState.key" :class="{ 'is-warning-score': warning, 'is-animated': true }" :aria-label="scoreState.key === 'unknown' ? '长寿指数暂无评分' : `长寿指数${report.score}分，${scoreState.label}`">
    <div class="score-noise"></div>
    <div class="score-meta">
      <span>REPORT / {{ report.reportDate }}</span>
      <SaveReportButton v-if="showSaveReport" :href="report.assets.downloadImage" />
    </div>
    <div :key="replayKey" class="score-stage">
      <svg class="score-rings" viewBox="0 0 320 320" aria-hidden="true">
        <defs><linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" :stop-color="scoreState.accent" /><stop offset="1" :stop-color="scoreState.color" /></linearGradient></defs>
        <circle class="ring-track" cx="160" cy="160" r="132" /><circle class="ring-progress" cx="160" cy="160" r="132" /><circle class="ring-fine" cx="160" cy="160" r="108" /><path class="ring-dash" d="M52 160a108 108 0 0 1 216 0" />
      </svg>
      <div class="orbit orbit-a"><i></i></div><div class="orbit orbit-b"><i></i></div>
      <div class="score-core"><span>LONGEVITY</span><div><strong id="scoreValue" class="score-value" :data-score="report.score">{{ scoreState.key === 'unknown' ? '—' : displayScore }}</strong><small>分</small></div><em>{{ scoreState.label }}</em></div>
      <div class="scan-beam"></div>
    </div>
    <div class="score-foot">
      <div><span>超过同龄人</span><strong>{{ report.peerPercent }}<small>%</small></strong></div>
      <div><span>生理年龄差</span><strong>+{{ ageDifference }}<small>岁</small></strong></div>
      <button id="replayScore" class="replay-button" type="button" aria-label="重播长寿指数动效" @click="replay"><svg viewBox="0 0 24 24"><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 0-2 5" /></svg><span>重播动效</span></button>
    </div>
  </section>
  <ScoreLegend />
</template>
