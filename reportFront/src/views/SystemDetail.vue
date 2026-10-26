<script setup>
import { consumeSourceReading, restoreScroll } from '@/utils/planNavigation.js'
import { computed, nextTick, onMounted, ref, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ReportApiError,
  fetchSystemDetail,
  reportParamsFromLocation,
  reportRouteQueryFromLocation,
} from "@/api/reportClient.js";
import { toSystemViewModel } from "@/data/reportAdapter.js";
import DetailChart from "@/components/DetailChart.vue";
import { scoreAppearance, scoreStyle } from "@/utils/scoreColor.js";
import RecommendationCard from "@/components/RecommendationCard.vue";
import ReportErrorState from "@/components/ReportErrorState.vue";
import SystemDetailSkeleton from "@/components/SystemDetailSkeleton.vue";
import {
  restoreSystemDetailScroll,
  saveSystemDetailScroll,
} from "@/composables/useScrollRestoration.js";

const props = defineProps({ systemId: { type: String, default: "" } });
const route = props.systemId ? null : useRoute();
const router = useRouter();
const currentId = computed(
  () => props.systemId || route?.params.systemId || "",
);
const legacySystemCodes = {
  cardio: "SYS_CARDIO",
  lung: "SYS_LUNG",
  digest: "SYS_DIGEST",
  endocrine: "SYS_ENDOCRINE",
  female: "SYS_FEMALE",
  male: "SYS_MALE",
  immune: "SYS_IMMUNE",
  bone: "SYS_BONE",
};
const currentSystemCode = computed(
  () => legacySystemCodes[currentId.value] || currentId.value,
);
const reportQuery = computed(() => {
  // Keep the launch context current when Vue reuses this detail component.
  route?.fullPath;
  return reportRouteQueryFromLocation();
});
const fromAiConsult = computed(() => reportQuery.value.fromAiConsult === "1");
const consultReturnQuery = computed(() => {
  const query = { ...reportQuery.value };
  delete query.fromAiConsult;
  return query;
});
const backRoute = computed(() => fromAiConsult.value
  ? { name: "ai-consult", query: consultReturnQuery.value }
  : { name: "home", query: reportQuery.value });
const errorBackRoute = computed(() => reportQuery.value.reportId
  ? backRoute.value
  : null);

const state = ref("loading");
const errorKind = ref("");
const system = ref(null);

async function load() {
  const { reportCode, customerId } = reportParamsFromLocation();
  if (!reportCode || customerId === null) {
    errorKind.value = "not_found";
    state.value = "error";
    return;
  }
  state.value = "loading";
  try {
    const dto = await fetchSystemDetail(
      reportCode,
      currentSystemCode.value,
      customerId,
    );
    system.value = toSystemViewModel(dto.system);
    state.value = "ready";
    await nextTick();
    await restoreSystemDetailScroll(reportCode, currentSystemCode.value);
    const navigationQuery = reportRouteQueryFromLocation()
    const savedPlanSource = consumeSourceReading(navigationQuery, 'system-detail', currentSystemCode.value)
    if (savedPlanSource) await restoreScroll(savedPlanSource.scrollY)
  } catch (error) {
    errorKind.value = error instanceof ReportApiError ? error.kind : "network";
    state.value = "error";
  }
}

function rememberIndicatorPosition() {
  const { reportCode } = reportParamsFromLocation();
  saveSystemDetailScroll(reportCode, currentSystemCode.value);
}

function openIndicator(item) {
  if (!item?.indicator_code) return;
  rememberIndicatorPosition();
  router.push({
    name: "indicator-detail",
    params: {
      systemId: currentSystemCode.value,
      indicatorCode: item.indicator_code,
    },
    query: reportQuery.value,
  });
}

onMounted(load);

watchEffect(() => {
  if (typeof document !== "undefined") {
    document.title = system.value
      ? `${system.value.name}详情｜长寿指数`
      : "系统详情｜长寿指数";
  }
});
</script>

<template>
  <SystemDetailSkeleton v-if="state === 'loading'" />
  <ReportErrorState
    v-else-if="state !== 'ready'"
    :kind="errorKind"
    :back-to="errorBackRoute"
    :back-label="fromAiConsult ? '返回 AI 咨询' : '返回报告首页'"
  />

  <main v-else class="app-shell detail-v2" :data-system-id="system.id">
    <header class="top-nav detail-nav">
      <RouterLink
        class="round-button"
        :to="backRoute"
        :aria-label="fromAiConsult ? '返回 AI 咨询' : '返回长寿指数报告'"
        ><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg
      ></RouterLink>
      <div class="brand">
        <strong>{{ system.name }}详情</strong>
      </div>
    </header>
    <section class="detail-score-block" :style="scoreStyle(system.score)" :data-score-level="scoreAppearance(system.score).key">
      <div class="detail-score-heading">
        <h1>{{ system.name }}</h1>
        <span v-if="system.status" class="detail-score-status">{{ scoreAppearance(system.score).label }}</span>
      </div>
      <div class="detail-score-identity">
        <p v-if="system.summary">{{ system.summary }}</p>
      </div>
      <strong class="score-value">{{ system.score ?? "—" }}</strong>
    </section>
    <section
      v-if="!['lung', 'digest'].includes(system.id)"
      class="detail-visualization"
      :aria-labelledby="`${system.id}ChartTitle`"
    >
      <div class="detail-viz-head">
        <div>
          <span class="eyebrow">INHERITED DATA VIEW</span>
          <h2 :id="`${system.id}ChartTitle`">
            {{ system.visualization.title }}
          </h2>
        </div>
        <span>{{
          system.visualization.period
            ? `${system.visualization.period} · ${system.visualization.unit}`
            : `当前报告 · ${system.visualization.unit}`
        }}</span>
      </div>
      <DetailChart :system="system" @indicator-click="openIndicator" />
    </section>
    <section class="detail-editorial">
      <span class="eyebrow">SCORE STRUCTURE</span>
      <div class="section-heading">
        <h2>评分构成</h2>
        <span>满分 100</span>
      </div>
      <div class="detail-indicator-list">
        <RouterLink
          v-for="(item, index) in system.indicators"
          :key="item.indicator_code"
          class="detail-indicator-link"
          :style="scoreStyle(item.score)"
          :data-score-level="scoreAppearance(item.score).key"
          :data-indicator-code="item.indicator_code"
          :to="{
            name: 'indicator-detail',
            params: {
              systemId: currentSystemCode,
              indicatorCode: item.indicator_code,
            },
            query: reportQuery,
          }"
          :aria-label="`查看${item.name}详情`"
          @click="rememberIndicatorPosition"
          ><article>
            <span class="indicator-no">{{
              String(index + 1).padStart(2, "0")
            }}</span>
            <div>
              <h3>{{ item.name }}</h3>
              <small>权重 {{ item.weight }}%</small
              ><i><b :style="{ width: `${item.score ?? 0}%` }"></b></i>
            </div>
            <strong class="score-value">{{ item.score ?? '—' }}</strong>
          </article></RouterLink
        >
      </div>
    </section>
    <RecommendationCard :system="system" variant="detail" />
    <section
      v-if="system.direct.length"
      id="directBlock"
      class="detail-editorial"
    >
      <span class="eyebrow">LIVE MEASUREMENT</span>
      <div class="section-heading">
        <h2>直接采集</h2>
        <span>不参与加权</span>
      </div>
      <div class="detail-direct-list">
        <article v-for="item in system.direct" :key="item.name">
          <span>{{ item.name }}</span
          ><strong
            >{{ item.value
            }}<small v-if="item.unit">{{ item.unit }}</small></strong
          ><small>采集结果</small>
        </article>
      </div>
    </section>
    <section
      v-if="system.interpretation || system.actions.length"
      class="detail-conclusion"
    >
      <span class="eyebrow">INTERPRETATION</span>
      <h2>行动建议</h2>
      <p v-if="system.interpretation">{{ system.interpretation }}</p>
      <ul v-if="system.actions.length">
        <li v-for="item in system.actions" :key="item">
          {{ item }}
        </li>
      </ul>
    </section>
    <RouterLink class="detail-back" :to="backRoute"
      >{{ fromAiConsult ? '返回 AI 咨询' : '返回长寿指数报告' }} <span>→</span></RouterLink
    >
    <footer><p>结果仅用于健康趋势管理，不构成临床诊断。</p></footer>
  </main>
</template>

<style scoped>
.detail-v2 .detail-score-block {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 20px;
}

.detail-score-heading {
  grid-column: 1 / -1;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-score-heading h1 {
  margin: 0;
}

.detail-score-status {
  flex: none;
}

.detail-score-identity {
  grid-column: 1;
  grid-row: 2;
  align-self: start;
}

.detail-score-block > strong {
  grid-column: 2;
  grid-row: 1 / 3;
  align-self: end;
}
</style>
