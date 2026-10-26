<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { fetchPlanDetail, ERROR_KINDS, ReportApiError, reportRouteQueryFromLocation } from '@/api/reportClient.js'
import { adaptPlanDetail } from '@/data/reportAdapter.js'
import { planBaseQuery, readPlanNavigation, createPlanNavigation, markSourceRestore, savePlanReading, consumePlanReading, restoreScroll } from '@/utils/planNavigation.js'
import { scoreStyle } from '@/utils/scoreColor.js'
import ReportErrorState from '@/components/ReportErrorState.vue'
import PlanProductDetails from '@/components/PlanProductDetails.vue'
import backIcon from '@/assets/report-back.svg'

const route = useRoute()
const router = useRouter()
const state = ref('loading')
const errorKind = ref('')
const detail = ref(null)
const key = ref('')
const expandedProductIds = ref([])
const imageIndexByProduct = ref({})
const dock = ref(null)
const dockHeight = ref(150)
let dockObserver
watch(dock, element => {
  dockObserver?.disconnect()
  if (!element || typeof ResizeObserver === 'undefined') return
  dockObserver = new ResizeObserver(() => { dockHeight.value = element.getBoundingClientRect().height })
  dockObserver.observe(element)
}, { flush: 'post' })
onUnmounted(() => { version++; dockObserver?.disconnect() })
function toggleProduct(id, expanded) {
  expandedProductIds.value = expanded ? [...new Set([...expandedProductIds.value, id])] : expandedProductIds.value.filter(item => item !== id)
}
let version = 0
const query = computed(() => planBaseQuery(route.query))
const primary = computed(() => detail.value?.primary_indicator)
const identity = computed(() => ({ ...query.value, planId: String(route.params.planId), indicatorCode: primary.value?.indicator_code || route.query.indicatorCode }))
const heroImage = computed(() => detail.value?.products?.find(p => p.images?.length)?.images[0])
const failedHero = ref(false)
const home = computed(() => ({ name: 'home', query: query.value }))

async function back() {
  const target = markSourceRestore(key.value, identity.value)
  await router.replace(target || home.value)
}
async function prepareChild() {
  const reportIdentity = { ...identity.value }
  if (!readPlanNavigation(key.value, reportIdentity)) {
    key.value = createPlanNavigation(reportIdentity, home.value)
  }
  savePlanReading(key.value, reportIdentity, { scrollY: window.scrollY, expandedProductIds: expandedProductIds.value, imageIndexByProduct: imageIndexByProduct.value })
  if (key.value && route.query.planNavKey !== key.value) {
    await router.replace({ name: 'plan-detail', params: { planId: reportIdentity.planId }, query: { ...route.query, planNavKey: key.value } })
  }
  return { ...query.value, planId: reportIdentity.planId, indicatorCode: reportIdentity.indicatorCode, fromPlan: '1', ...(key.value ? { planNavKey: key.value } : {}) }
}
async function visitIndicator(indicator = primary.value) {
  const params = { systemId: indicator.system_code, indicatorCode: indicator.indicator_code }
  const childQuery = await prepareChild()
  await router.push({ name: 'indicator-detail', params, query: childQuery })
}
async function consult() {
  if (detail.value?.consult.status !== 'available') return
  await router.push({ name: 'ai-consult', query: await prepareChild() })
}
onBeforeRouteLeave(to => {
  const record = readPlanNavigation(key.value, identity.value)
  const destination = planBaseQuery(reportRouteQueryFromLocation(globalThis.location?.search || '', `#/?${new URLSearchParams(to.query)}`))
  const ownChild = to.query.fromPlan === '1' && to.query.planNavKey === key.value && String(to.query.planId) === identity.value.planId
  if (record && to.name === record.origin.name && !ownChild &&
      destination.reportId === identity.value.reportId && destination.userId === identity.value.userId) {
    markSourceRestore(key.value, identity.value)
  }
})
async function load() {
  const request = ++version
  state.value = 'loading'
  detail.value = null
  expandedProductIds.value = []
  imageIndexByProduct.value = {}
  failedHero.value = false
  key.value = String(route.query.planNavKey || '')
  const reportId = query.value.reportId
  const userId = Number(query.value.userId)
  const planId = Number(route.params.planId)
  if (!reportId || !Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(planId) || planId <= 0) {
    errorKind.value = ERROR_KINDS.NOT_FOUND
    state.value = 'error'
    return
  }
  try {
    const data = await fetchPlanDetail(reportId, planId, userId, route.query.indicatorCode)
    if (request !== version) return
    if (data?.report_code !== reportId || data?.plan?.plan_id !== planId ||
        !data.primary_indicator || (route.query.indicatorCode && data.primary_indicator.indicator_code !== route.query.indicatorCode)) {
      throw new ReportApiError(ERROR_KINDS.PLAN_NOT_FOUND)
    }
    detail.value = adaptPlanDetail(data)
    state.value = 'ready'
    document.title = `${data.plan.name}｜方案详情`
    await nextTick()
    const saved = consumePlanReading(key.value, identity.value, 'plan')
    if (saved) {
      expandedProductIds.value = (saved.expandedProductIds || []).filter(id => data.products.some(product => product.product_id === id && product.detail_blocks?.length))
      imageIndexByProduct.value = saved.imageIndexByProduct || {}
      await nextTick()
    }
    await restoreScroll(saved?.scrollY || 0, () => request === version)
  } catch (error) {
    if (request !== version) return
    errorKind.value = error instanceof ReportApiError ? error.kind : ERROR_KINDS.NETWORK
    state.value = 'error'
  }
}
watch([() => route.params.planId, () => query.value.reportId, () => query.value.userId, () => route.query.indicatorCode], load, { immediate: true })
watch(() => route.query.planNavKey, value => { key.value = String(value || '') })
</script>

<template>
  <main v-if="state === 'loading'" class="app-shell plan-detail-page plan-loading" aria-busy="true" aria-label="正在加载方案详情">
    <div class="plan-loading-title"></div><div class="plan-loading-hero"></div><div class="plan-loading-line"></div><div class="plan-loading-line"></div>
  </main>
  <ReportErrorState v-else-if="state === 'error'" :kind="errorKind" :back-to="home" back-label="返回报告" />
  <main v-else class="app-shell plan-detail-page" data-testid="plan-detail" :style="{ '--plan-dock-height': `${dockHeight}px` }">
    <header class="plan-header"><button type="button" aria-label="返回上一页" @click="back"><img referrerpolicy="no-referrer" :src="backIcon" alt=""></button><span>方案详情</span></header>
    <div class="plan-body">
      <section class="plan-hero">
        <div><p class="plan-eyebrow">健康管理方案</p><h1>{{ detail.plan.name }}</h1></div>
        <img referrerpolicy="no-referrer" v-if="heroImage && !failedHero" :src="heroImage.url" :alt="heroImage.alt" class="plan-hero-image" @error="failedHero = true">
        <div v-else class="plan-image-missing">暂无产品图片</div>
      </section>
      <section class="plan-association" aria-label="本次报告关联" :style="scoreStyle(primary.indicator_score)">
        <p>本次报告关联</p>
        <div class="plan-association-row"><strong>{{ primary.indicator_name }}</strong><span class="plan-score"><b>{{ primary.indicator_score ?? '未提供' }}</b><small>活力值</small></span><button type="button" class="plan-indicator-shortcut" @click="visitIndicator()">查看指标<img referrerpolicy="no-referrer" :src="backIcon" alt=""></button></div>
        <div v-if="detail.related_indicators.length > 1" class="plan-other-indicators"><button v-for="item in detail.related_indicators.filter(i => i.indicator_code !== primary.indicator_code)" :key="item.indicator_code" type="button" @click="visitIndicator(item)">{{ item.indicator_name }} · {{ item.indicator_score }} 活力值</button></div>
      </section>
      <section class="plan-introduction"><h2>了解这项方案</h2><p v-if="detail.plan.description">{{ detail.plan.description }}</p><p v-else class="plan-muted">此方案暂未提供详细介绍。</p></section>
      <section class="plan-products"><h2>产品与说明</h2>
        <PlanProductDetails v-for="product in detail.products" :key="product.product_id" :product="product" :expanded="expandedProductIds.includes(product.product_id)" :image-index="imageIndexByProduct[product.product_id] || 0" @update:expanded="toggleProduct(product.product_id, $event)" @update:image-index="imageIndexByProduct[product.product_id] = $event" />
        <p v-if="!detail.products.length" class="plan-muted">当前没有可展示的配套产品。</p><p class="plan-product-note">产品信息以实际标识及说明为准。</p>
      </section>
    </div>
    <footer ref="dock" class="plan-dock"><div class="plan-actions"><button type="button" class="plan-secondary" @click="visitIndicator()">查看关联指标</button><button type="button" class="plan-primary" :disabled="detail.consult.status !== 'available'" @click="consult">咨询 AI 长寿顾问</button></div><p v-if="detail.consult.status !== 'available'" class="plan-consult-message" role="status">{{ detail.consult.message || '咨询服务暂不可用，请稍后再试。' }}</p><p class="plan-disclaimer">仅作日常健康管理参考，不能替代医学诊断或治疗。</p></footer>
  </main>
</template>

<style scoped>
.plan-detail-page{--plan-ink:#173356;--plan-copy:#6e8099;--plan-blue:#416fd2;max-width:430px;overflow:visible;min-height:100dvh;color:var(--plan-ink);background:#f9fbfe;padding-bottom:calc(var(--plan-dock-height,150px) + 24px);font-size:15px}
.plan-header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:center;height:80px;background:#f9fbfef5;font-size:20px;font-weight:700}.plan-header button{position:absolute;left:10px;display:grid;place-items:center;width:44px;height:44px;padding:10px;border:0;background:transparent}.plan-header img{width:24px;height:24px}
.plan-other-indicators{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.plan-other-indicators button{font-size:13px;color:var(--plan-blue);background:transparent;border:0;min-height:44px;padding:4px 0}
.plan-body{padding:0 18px}.plan-hero{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);align-items:center;gap:10px;min-height:176px;padding:0 4px 20px}.plan-eyebrow{margin:0 0 12px;color:var(--plan-blue);font-size:14px;font-weight:600}.plan-hero h1{max-width:7.5em;font-size:26px;line-height:1.45;margin:0;font-weight:750;overflow-wrap:anywhere}.plan-hero-image{width:100%;height:150px;object-fit:contain;transform:scale(1.2)}.plan-image-missing{display:grid;place-items:center;min-height:130px;color:var(--plan-copy);font-size:13px}
.plan-association{border-radius:14px;background:#eaf2ff;padding:14px 18px}.plan-association>p{margin:0 0 8px;color:var(--plan-blue);font-size:15px}.plan-association-row{display:flex;align-items:center;gap:14px}.plan-association-row>strong{font-size:20px;line-height:1.5;overflow-wrap:anywhere}.plan-score{display:flex;align-items:baseline;gap:5px;padding-left:14px;border-left:1px solid #c4d7f1;white-space:nowrap}.plan-score b{font-size:30px;line-height:1.3;color:var(--score-color)}.plan-score small{font-size:13px;color:var(--plan-copy)}.plan-indicator-shortcut{margin-left:auto;display:flex;align-items:center;justify-content:end;gap:4px;min-height:44px;padding:0;border:0;background:transparent;color:var(--plan-blue);font-size:14px;white-space:nowrap}.plan-indicator-shortcut img{width:18px;height:18px;transform:rotate(180deg)}
.plan-introduction{padding:30px 2px 24px;border-bottom:1px solid #e5edf6}.plan-detail-page h2{margin:0 0 12px;font-size:20px;line-height:1.5;font-weight:700}.plan-introduction p{font-size:16px;line-height:1.8;white-space:pre-line;margin:0;color:var(--plan-copy);overflow-wrap:anywhere}.plan-products{padding:26px 0}.plan-product-basic{display:flex;gap:14px;align-items:center;background:#f1f6fc;border-radius:12px;padding:12px;margin-bottom:12px}.plan-product-basic>img{width:80px;height:90px;object-fit:contain}.plan-product-basic>div{min-width:0}.plan-product-basic h3{font-size:16px;line-height:1.6;margin:0 0 8px;overflow-wrap:anywhere}.plan-product-basic p{font-size:15px;line-height:1.7;margin:0;color:var(--plan-copy)}.plan-product-note,.plan-muted{font-size:13px;line-height:1.8;color:var(--plan-copy)}.plan-product-note{margin:14px 2px 0}
.plan-dock{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;padding:14px 18px calc(18px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #edf2f8;z-index:15;box-sizing:border-box}.plan-actions{display:grid;grid-template-columns:1fr 1.3fr;gap:8px}.plan-actions button{min-height:50px;padding:8px 10px;border-radius:10px;font-size:15px;line-height:1.4;font-weight:600}.plan-secondary{border:1px solid #a9c0f3;color:var(--plan-blue);background:#fff}.plan-primary{border:1px solid var(--plan-blue);background:var(--plan-blue);color:#fff}.plan-primary:disabled{background:#7e92b3;border-color:#7e92b3;cursor:default}.plan-disclaimer{text-align:center;font-size:13px;line-height:1.7;margin:14px 0 0;color:#7c8aa1}.plan-consult-message{font-size:13px;text-align:center;line-height:1.5;margin:10px 0 0;color:var(--plan-copy)}.plan-detail-page button{cursor:pointer;font-family:inherit}.plan-detail-page button:focus-visible{outline:2px solid #325fc6;outline-offset:3px}
.plan-loading{padding:26px 20px}.plan-loading>div{border-radius:12px;background:#e8eef6;margin-bottom:28px}.plan-loading-title{height:30px;width:45%;margin:auto}.plan-loading-hero{height:210px}.plan-loading-line{height:95px}
@media(max-width:359px){.plan-body{padding:0 16px}.plan-hero h1{font-size:24px}.plan-association{padding:14px}.plan-association-row{gap:8px}.plan-association-row>strong{font-size:17px}.plan-score{padding-left:8px;gap:3px}.plan-score b{font-size:27px}.plan-score small{font-size:13px}.plan-indicator-shortcut{font-size:13px}.plan-actions button{font-size:14px}}
</style>
