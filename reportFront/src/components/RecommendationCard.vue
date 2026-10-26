<script setup>
import { computed, inject } from 'vue'
import { routerKey } from 'vue-router'
import { createPlanNavigation, discardPlanNavigation, planDetailRoute } from '@/utils/planNavigation.js'
import { reportParamsFromLocation, reportRouteQueryFromLocation } from '@/api/reportClient.js'
import { saveHomeScroll, saveSystemDetailScroll } from '@/composables/useScrollRestoration.js'
import { scoreAppearance, scoreStyle } from '@/utils/scoreColor.js'

const props = defineProps({
  system: { type: Object, required: true },
  variant: { type: String, default: 'home' },
})
const recommendation = computed(() => props.system.recommendation)
const titleLines = computed(() => recommendation.value?.title.split('\n') ?? [])
const reportQuery = reportRouteQueryFromLocation()
const router = inject(routerKey, null)
const planRoute = computed(() => planDetailRoute(reportQuery, recommendation.value?.planId, recommendation.value?.triggerIndicatorCode))
async function openPlan(event) {
  if (!router) return
  event.preventDefault()
  if (props.variant === 'home') saveHomeScroll()
  else {
    const { reportCode } = reportParamsFromLocation()
    saveSystemDetailScroll(reportCode, props.system.systemCode)
  }
  const context = recommendation.value
  const identity = { ...reportQuery, planId: String(context.planId), indicatorCode: context.triggerIndicatorCode }
  const origin = props.variant === 'home'
    ? { name: 'home', query: reportQuery }
    : { name: 'system-detail', params: { systemId: props.system.systemCode }, query: reportQuery }
  const key = createPlanNavigation(identity, origin, { scrollY: window.scrollY })
  const failure = await router.push(planDetailRoute(reportQuery, context.planId, context.triggerIndicatorCode, key))
  if (failure) discardPlanNavigation(key)
}

</script>

<template>
  <section v-if="recommendation && variant === 'home'" class="issue-plan" :data-plan-theme="system.id === 'bone' ? 'bone' : 'sleep'" :style="scoreStyle(recommendation.indicatorScore)" :data-score-level="scoreAppearance(recommendation.indicatorScore).key" :class="`issue-plan-${system.id === 'bone' ? 'bone' : 'sleep'}`" :aria-labelledby="`${system.id}PlanTitle`" :data-recommendation-for="system.id">
    <div class="issue-plan-label"><span>问题聚焦</span><strong :class="{ 'score-value': scoreAppearance(recommendation.indicatorScore).key !== 'unknown' }">{{ recommendation.issue }}</strong></div>
    <div class="issue-plan-main">
      <div class="issue-plan-copy"><span class="eyebrow">{{ recommendation.eyebrow }}</span><h2 :id="`${system.id}PlanTitle`"><template v-for="(line, index) in titleLines" :key="line">{{ line }}<br v-if="index < titleLines.length - 1"></template></h2><p>{{ recommendation.context }}</p><div class="issue-plan-tags"><span v-for="tag in recommendation.tags" :key="tag">{{ tag }}</span></div></div>
      <div class="issue-plan-visual product-contain"><img :src="recommendation.image" :alt="recommendation.imageAlt" width="180" height="270"></div>
    </div>
    <RouterLink class="issue-plan-action" :to="planRoute" @click="openPlan"><span><b>查看方案</b><small v-if="recommendation.actionHint">{{ recommendation.actionHint }}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></RouterLink>
    <p class="issue-plan-note">仅作日常健康管理参考，不能替代医学诊断或治疗。</p>
  </section>

  <section v-else-if="recommendation" class="detail-product-recommendation" :data-plan-theme="system.id === 'bone' ? 'bone' : 'sleep'" :style="scoreStyle(recommendation.indicatorScore)" :data-score-level="scoreAppearance(recommendation.indicatorScore).key" :data-recommendation-for="system.id" :aria-labelledby="`${system.id}DetailProductTitle`">
    <div class="detail-product-head"><span>REPORT MATCH / 企业严选</span><strong><i></i>健康管理推荐</strong></div>
    <div class="detail-product-main">
      <div class="detail-product-visual product-contain"><img :src="recommendation.image" :alt="recommendation.imageAlt" width="208" height="160"><span>PREMIUM SUPPORT</span></div>
      <div class="detail-product-copy"><span class="detail-product-module" :class="{ 'score-value': scoreAppearance(recommendation.indicatorScore).key !== 'unknown' }">对应问题 · {{ recommendation.issue }}</span><h2 :id="`${system.id}DetailProductTitle`"><template v-for="(line, index) in titleLines" :key="line">{{ line }}<br v-if="index < titleLines.length - 1"></template></h2><p>{{ recommendation.context }}</p></div>
    </div>
    <RouterLink class="detail-product-action" :to="planRoute" aria-label="查看方案" @click="openPlan"><span><b>查看方案</b><small>了解方案与配套产品</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></RouterLink>
    <p class="detail-product-disclaimer">温馨提示：本推荐仅用于日常健康管理参考。保健食品不是药物，不能替代药物治疗疾病。</p>
  </section>
</template>

<style scoped>
/* Product identity uses its own palette; --score-* keeps the score semantics. */
[data-plan-theme] {
  --plan-ink: #203452;
  --plan-copy: #546780;
  --plan-accent: #426bd2;
  --plan-edge: #d6e1f2;
  --plan-wash: #eaf0fc;
  --plan-glow: #d7e5fc;
  --plan-shadow: #365b9417;
  --plan-surface: linear-gradient(135deg, #f8faff 0%, #edf3ff 100%);
  --plan-stage: radial-gradient(ellipse at 44% 32%, #ffffff 0%, #edf3fc 64%, #dce7f7 100%);
  --plan-button: linear-gradient(110deg, #416dd0 0%, #547ed5 100%);
}
[data-plan-theme='bone'] {
  --plan-accent: #427d87;
  --plan-edge: #d4e3e7;
  --plan-wash: #eaf3f4;
  --plan-glow: #dfedec;
  --plan-surface: linear-gradient(135deg, #f8fbfc 0%, #edf4f6 100%);
  --plan-stage: radial-gradient(ellipse at 44% 32%, #ffffff 0%, #edf4f4 64%, #dce9ec 100%);
}
</style>
