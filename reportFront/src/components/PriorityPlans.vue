<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { reportRouteQueryFromLocation } from "@/api/reportClient.js";
import { saveHomeScroll } from "@/composables/useScrollRestoration.js";
import { reportAssets } from "@/data/report.js";
import {
  createPlanNavigation,
  discardPlanNavigation,
  planDetailRoute,
} from "@/utils/planNavigation.js";
import { getVisibleSystems } from "@/utils/report.js";

const props = defineProps({ report: { type: Object, required: true } });
const router = useRouter();
const reportQuery = reportRouteQueryFromLocation();
const productCutouts = new Set([
  reportAssets.sleepPlanImage,
  reportAssets.calciumPlanImage,
]);

const priorityRows = computed(() =>
  getVisibleSystems(props.report)
    .filter((system) => system.recommendation)
    .map((system) => {
      const plan = system.recommendation;
      const indicator = system.indicators.find(
        (item) => item.indicator_code === plan.triggerIndicatorCode,
      );
      return {
        id: system.id,
        name:
          indicator?.name || plan.issue?.split(" · 活力值")[0] || system.name,
        plan,
        title: plan.eyebrow || plan.title,
      };
    }),
);

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
  ) {
    return;
  }

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
    v-if="priorityRows.length"
    class="priority-plans"
    aria-labelledby="priorityPlansTitle"
    data-testid="priority-plans"
  >
    <div class="priority-plans-heading">
      <div class="priority-title-line">
        <h2 id="priorityPlansTitle">本次优先关注</h2>
      </div>
      <p>已匹配健康管理方案</p>
    </div>

    <ul class="priority-list" aria-label="优先关注指标及对应方案">
      <li
        v-for="(row, index) in priorityRows"
        :key="row.id"
        class="priority-item"
      >
        <div class="priority-item-heading">
          <h3 class="priority-item-name">{{ row.name }}</h3>
          <p class="priority-item-score">
            <span>活力值</span>
            <b>{{ row.plan.indicatorScore ?? "—" }}</b>
          </p>
        </div>

        <RouterLink v-slot="{ href }" :to="planRoute(row.plan)" custom>
          <a
            class="management-plan-row"
            :class="{ 'has-product-image': row.plan.image }"
            :href="href"
            :aria-label="`查看方案：${row.title}`"
            @click="openPlan($event, row.plan)"
          >
            <span class="management-plan-number" aria-hidden="true">
              {{ String(index + 1).padStart(2, "0") }}
            </span>
            <span
              v-if="row.plan.image"
              class="management-plan-visual"
              :class="{
                'is-product-cutout': productCutouts.has(row.plan.image),
              }"
              aria-hidden="true"
            >
              <img :src="row.plan.image" alt="" />
            </span>
            <span class="management-plan-title">{{ row.title }}</span>
            <span class="management-plan-action">
              查看方案
              <i class="management-plan-arrow" aria-hidden="true"></i>
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
  --priority-ink: #101c2e;
  --priority-muted: #566981;
  --priority-line: #d3e1ef;
  --priority-link: #0c67a8;
  --priority-thumbnail: clamp(56px, 19vw, 78px);
  padding: 26px 10px 16px;
  color: var(--priority-ink);
  background: #eaf2f8;
}

.priority-plans-heading {
  margin: 0 12px 14px;
}

.priority-title-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.priority-title-line h2 {
  margin: 0;
  font-size: 23px;
  font-weight: 700;
  line-height: 1.4;
}

.priority-title-line span {
  color: var(--priority-muted);
  font-size: 19px;
  font-weight: 600;
}

.priority-plans-heading p {
  margin: 7px 0 0;
  color: var(--priority-muted);
  font-size: 14px;
  line-height: 1.4;
}

.priority-list {
  margin: 0;
  padding: 0 13px;
  border-radius: 17px;
  background: var(--white);
  list-style: none;
}

.priority-item {
  padding: 12px 2px;
}

.priority-item + .priority-item {
  border-top: 1px solid var(--priority-line);
}

.priority-item-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-height: 32px;
}

.priority-item-name {
  min-width: 0;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.priority-item-score {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--priority-muted);
  font-size: 14px;
}

.priority-item-score b {
  color: var(--priority-ink);
  font-size: 25px;
  line-height: 1.25;
}

.management-plan-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(7px, 2.2vw, 9px);
  min-height: 80px;
  margin-top: 1px;
  color: inherit;
  text-decoration: none;
  border-radius: 6px;
}

.management-plan-row.has-product-image {
  grid-template-columns: 18px var(--priority-thumbnail) minmax(0, 1fr) auto;
}

.management-plan-row:focus-visible {
  outline: 2px solid var(--priority-link);
  outline-offset: 1px;
}

.management-plan-row:active .management-plan-action {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.management-plan-number {
  color: #8b96a8;
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  text-align: center;
}

.management-plan-visual {
  position: relative;
  display: block;
  width: 100%;
  height: 80px;
  overflow: hidden;
}

.management-plan-visual img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.is-product-cutout img {
  /* Center the stock artwork so only its transparent margins extend outside the frame. */
  position: absolute;
  inset-inline: 3px;
  top: 50%;
  width: calc(100% - 6px);
  height: auto;
  transform: translateY(-50%);
}

.management-plan-title {
  display: flex;
  align-items: center;
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.has-product-image .management-plan-title {
  min-height: 29px;
  padding-inline-start: clamp(7px, 2.2vw, 9px);
  border-inline-start: 1px solid #c7d9ea;
}

.management-plan-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 44px;
  color: var(--priority-link);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.management-plan-arrow {
  width: 13px;
  height: 13px;
  background-color: currentColor;
  mask: url("../assets/report-back.svg") center / 17px no-repeat;
  transform: rotate(180deg);
}

.management-plans-note {
  margin: 12px 4px 0;
  color: var(--priority-muted);
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
}
</style>
