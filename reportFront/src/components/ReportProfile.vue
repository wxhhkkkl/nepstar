<script setup>
import { computed } from 'vue'

const props = defineProps({ report: { type: Object, required: true } })
const prioritySystems = computed(() =>
  [...(props.report.systems || [])]
    .filter((system) => Number.isFinite(Number(system.score)))
    .sort((left, right) => Number(left.score) - Number(right.score))
    .slice(0, 2),
)
const priorityNames = computed(() => prioritySystems.value.map((system) => system.name).join('・') || '—')
const priorityScore = computed(() => prioritySystems.value[0]?.score ?? '—')
</script>

<template>
  <section class="editorial-intro">
    <span class="index-no">01</span>
    <div><span class="eyebrow">LONGEVITY PROFILE</span><h1>你的身体，需要以<br><em>更主动的节奏</em>修复</h1><p>{{ report.summary }}</p></div>
  </section>
  <section class="quick-bento" aria-label="报告摘要">
    <article class="quick-card age-card"><span>生理年龄</span><strong>{{ report.biologicalAge }}</strong><small>比实际年龄大 {{ (report.biologicalAge - report.actualAge).toFixed(1) }} 岁</small><div class="age-axis"><i></i></div></article>
    <article class="quick-card lifespan-card"><span>健康寿命预估</span><strong>{{ report.healthyLifeExpectancy }}<small>岁</small></strong><svg viewBox="0 0 120 34" aria-hidden="true"><path d="M3 23C20 20 24 24 39 21s18-12 31-10 21 8 47 3" /></svg></article>
    <article class="quick-card focus-card"><span>本次优先项</span><strong>{{ priorityNames }}</strong><small>按本次系统得分排序</small><i>{{ priorityScore }}</i></article>
  </section>
</template>
