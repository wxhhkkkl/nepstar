<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { reportRouteQueryFromLocation } from "@/api/reportClient.js";
import { saveHomeScroll } from "@/composables/useScrollRestoration.js";
import {
  createPlanNavigation,
  discardPlanNavigation,
  planDetailRoute,
} from "@/utils/planNavigation.js";
import { getVisibleSystems } from "@/utils/report.js";

const props = defineProps({ report: { type: Object, required: true } });
const router = useRouter();
const reportQuery = reportRouteQueryFromLocation();
const prioritySystems = computed(() =>
  getVisibleSystems(props.report).filter((system) => system.recommendation),
);

function indicatorName(system) {
  const { issue, triggerIndicatorCode } = system.recommendation;
  const indicator = system.indicators.find(
    (item) => item.indicator_code === triggerIndicatorCode,
  );
  return indicator?.name || issue?.split(" · 活力值")[0] || system.name;
}

function planRoute(plan, key) {
  return planDetailRoute(
    reportQuery,
    plan.planId,
    plan.triggerIndicatorCode,
    key,
  );
}

async function openPlan(event, plan) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  saveHomeScroll();
  const identity = {
    ...reportQuery,
    planId: plan.planId,
    indicatorCode: plan.triggerIndicatorCode,
  };
  const key = createPlanNavigation(
    identity,
    { name: "home", query: reportQuery },
    { scrollY: window.scrollY },
  );
  const failure = await router.push(planRoute(plan, key));
  if (failure) discardPlanNavigation(key);
}
</script>

<template>
  <section
    v-if="prioritySystems.length"
    class="priority-plans"
    aria-labelledby="priorityPlansTitle"
    data-testid="priority-plans"
  >
    <div class="priority-plans-heading">
      <h2 id="priorityPlansTitle">本次优先关注</h2>
      <span>已匹配管理方案</span>
    </div>
    <ul class="priority-focus-list" aria-label="优先关注指标">
      <li
        v-for="system in prioritySystems"
        :key="system.id"
        class="priority-focus-item"
      >
        <article class="priority-focus-card">
          <h3>{{ indicatorName(system) }}</h3>
          <div class="priority-focus-score">
            <span>活力值</span>
            <b>{{ system.recommendation.indicatorScore ?? "—" }}</b>
            <svg
              class="priority-sparkline"
              viewBox="0 0 185 50"
              aria-hidden="true"
            >
              <path d="M2 41C31 35 44 34 67 22S106 7 128 13s33 4 55-10" />
            </svg>
          </div>
        </article>
      </li>
    </ul>
    <ul class="management-plans-list" aria-labelledby="managementPlansTitle">
      <li
        v-for="system in prioritySystems"
        :key="system.id"
        class="management-plan-item"
      >
        <RouterLink
          v-slot="{ href }"
          :to="planRoute(system.recommendation)"
          custom
        >
          <a
            class="management-plan-card"
            :href="href"
            :aria-label="`查看${system.recommendation.eyebrow || system.recommendation.title}`"
            @click="openPlan($event, system.recommendation)"
          >
            <span class="management-plan-visual">
              <img
                v-if="system.recommendation.image"
                :src="system.recommendation.image"
                :alt="system.recommendation.imageAlt"
                width="220"
                height="220"
              />
            </span>
            <span class="management-plan-title">{{
              system.recommendation.eyebrow || system.recommendation.title
            }}</span>
            <span class="management-plan-action">
              <span>查看方案</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </span>
          </a>
        </RouterLink>
      </li>
    </ul>
    <p class="management-plans-note">仅供日常健康管理参考</p>
  </section>
</template>

<style scoped>
.priority-plans {
  margin: 14px 0 18px;
  padding: clamp(20px, 4.8vw, 60px) clamp(12px, 3.2vw, 40px)
    clamp(18px, 4.4vw, 55px);
  color: var(--ink);
  background: radial-gradient(
    ellipse at 54% 37%,
    #f0f7ff 0%,
    #eaf3ff 54%,
    #dfecfc 100%
  );
}

.priority-plans-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 1.8vw;
}

.priority-plans-heading h2 {
  margin: 0;
  font-size: clamp(18px, 4.2vw, 52px);
  font-weight: 750;
  line-height: 1.3;
  letter-spacing: -0.035em;
}

.priority-plans-heading > span {
  color: var(--muted);
  font-size: clamp(12px, 3.4vw, 42px);
  line-height: 1.4;
  white-space: nowrap;
}

.priority-focus-list,
.management-plans-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(8px, 2.4vw, 30px);
  margin: clamp(10px, 2.3vw, 29px) 0 0;
  padding: 0;
  list-style: none;
}

.priority-focus-item {
  min-width: 0;
}

.priority-focus-card {
  min-height: clamp(72px, 16.7vw, 208px);
  padding: clamp(12px, 2.7vw, 34px) clamp(10px, 4vw, 50px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: clamp(16px, 3.4vw, 42px);
  background: rgba(255, 255, 255, 0.23);
}

.priority-focus-card h3 {
  overflow: hidden;
  margin: 0 0 clamp(4px, 1.3vw, 16px);
  color: #53647f;
  font-size: clamp(15px, 3.6vw, 44px);
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-focus-score {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: #5c6f8c;
}

.priority-focus-score > span {
  flex: 0 0 auto;
  font-size: clamp(14px, 3.5vw, 44px);
  line-height: 1.2;
}

.priority-focus-score b {
  flex: 0 0 auto;
  color: #2675bd;
  font: 750 clamp(25px, 7.4vw, 92px)/1 var(--font-report-number);
  letter-spacing: -0.07em;
}

.priority-sparkline {
  flex: 1 1 14.8vw;
  width: 14.8vw;
  min-width: 22px;
  height: clamp(18px, 4vw, 50px);
  margin-left: auto;
  overflow: visible;
}

.priority-sparkline path {
  fill: none;
  stroke: #6caada;
  stroke-width: 4;
  stroke-linecap: round;
}

.management-plans-heading {
  margin: clamp(22px, 5.5vw, 68px) 1.8vw 0;
  color: #17233a;
  font-size: clamp(18px, 4.2vw, 52px);
  font-weight: 750;
  line-height: 1.3;
  letter-spacing: -0.035em;
}

.management-plans-list {
  margin-top: clamp(12px, 2.8vw, 35px);
}

.management-plan-item {
  min-width: 0;
}

.management-plan-card {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: stretch;
  padding: clamp(9px, 2.1vw, 26px) clamp(12px, 3.7vw, 46px) 0;
  overflow: hidden;
  border: 1px solid #dce8f8;
  border-radius: clamp(16px, 3vw, 38px);
  color: inherit;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 8px 20px rgba(54, 91, 148, 0.055);
  text-decoration: none;
}

.management-plan-card:focus-visible {
  outline: 2px solid #2475b5;
  outline-offset: 3px;
  border-radius: clamp(16px, 3vw, 38px);
}

.management-plan-visual {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  height: clamp(104px, 27.5vw, 342px);
  min-height: 0;
}

.management-plan-visual img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.management-plan-title {
  display: block;
  max-width: 7.5em;
  flex: 0 0 auto;
  min-height: 0;
  padding: 0 0 1.3vw;
  color: #152541;
  font-size: clamp(14px, 3.9vw, 48px);
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.management-plan-action {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.3vw;
  min-height: 0;
  padding: 3vw 0 1.9vw;
  border-top: 1px solid #d5e2f3;
  color: #176ccc;
  font-size: clamp(14px, 3.9vw, 48px);
  font-weight: 650;
  line-height: 1.2;
}

.management-plan-action svg {
  flex: 0 0 clamp(14px, 1.8vw, 24px);
  width: clamp(14px, 1.8vw, 24px);
  height: clamp(14px, 1.8vw, 24px);
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.management-plans-note {
  margin: clamp(12px, 3.7vw, 46px) 0.7vw 0;
  color: #687991;
  font-size: clamp(12px, 2.6vw, 32px);
  line-height: 1.45;
}

@media (max-width: 360px) {
  .priority-plans {
    padding-inline: 12px;
  }

  .priority-focus-list,
  .management-plans-list {
    gap: 7px;
  }

  .priority-focus-card {
    padding-inline: 8px;
  }

  .priority-focus-card h3 {
    font-size: 14px;
  }

  .priority-focus-score > span {
    font-size: 12px;
  }

  .priority-focus-score b {
    font-size: 25px;
  }

  .management-plan-card {
    padding-inline: 10px;
  }
}
</style>
