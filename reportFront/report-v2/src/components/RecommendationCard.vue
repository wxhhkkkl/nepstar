<script setup>
import { computed } from 'vue'

const props = defineProps({
  system: { type: Object, required: true },
  variant: { type: String, default: 'home' },
})
const recommendation = computed(() => props.system.recommendation)
const titleLines = computed(() => recommendation.value?.title.split('\n') ?? [])
</script>

<template>
  <section v-if="recommendation && variant === 'home'" class="issue-plan" :class="`issue-plan-${system.id === 'bone' ? 'bone' : 'sleep'}`" :aria-labelledby="`${system.id}PlanTitle`" :data-recommendation-for="system.id">
    <div class="issue-plan-label"><span>问题聚焦</span><strong>{{ recommendation.issue }}</strong></div>
    <div class="issue-plan-main">
      <div class="issue-plan-copy"><span class="eyebrow">{{ recommendation.eyebrow }}</span><h2 :id="`${system.id}PlanTitle`"><template v-for="(line, index) in titleLines" :key="line">{{ line }}<br v-if="index < titleLines.length - 1"></template></h2><p>{{ recommendation.context }}</p><div class="issue-plan-tags"><span v-for="tag in recommendation.tags" :key="tag">{{ tag }}</span></div></div>
      <div class="issue-plan-visual product-contain"><img :src="recommendation.image" :alt="recommendation.imageAlt" width="180" height="270"></div>
    </div>
    <RouterLink class="issue-plan-action" :to="{ name: 'system-detail', params: { systemId: system.id } }"><span><b>{{ recommendation.actionLabel }}</b><small>{{ recommendation.actionHint }}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></RouterLink>
    <p class="issue-plan-note">仅作日常健康管理参考，不能替代医学诊断或治疗。</p>
  </section>

  <section v-else-if="recommendation" class="detail-product-recommendation" :data-recommendation-for="system.id" :aria-labelledby="`${system.id}DetailProductTitle`">
    <div class="detail-product-head"><span>REPORT MATCH / 企业严选</span><strong><i></i>健康管理推荐</strong></div>
    <div class="detail-product-main">
      <div class="detail-product-visual product-contain"><img :src="recommendation.image" :alt="recommendation.imageAlt" width="208" height="160"><span>PREMIUM SUPPORT</span></div>
      <div class="detail-product-copy"><span class="detail-product-module">对应问题 · {{ recommendation.issue }}</span><h2 :id="`${system.id}DetailProductTitle`"><template v-for="(line, index) in titleLines" :key="line">{{ line }}<br v-if="index < titleLines.length - 1"></template></h2><p>{{ recommendation.context }}</p></div>
    </div>
    <a class="detail-product-action" href="./AI长寿咨询聊天页设计稿.png" aria-label="咨询 AI 长寿顾问了解推荐依据"><span><b>咨询 AI 长寿顾问</b><small>进一步了解推荐依据</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></a>
    <p class="detail-product-disclaimer">温馨提示：本推荐仅用于日常健康管理参考。保健食品不是药物，不能替代药物治疗疾病。</p>
  </section>
</template>
