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
const priorityRows = computed(() => {
  const rows = prioritySystems.value.map((system) => ({
    system,
    isMock: false,
  }));
  const second = prioritySystems.value[1];
  const targetIndicatorCode = second?.recommendation?.triggerIndicatorCode;

  // Local demo only: keep fabricated health data out of production builds.
  if (
    import.meta.env.DEV &&
    prioritySystems.value.length === 2 &&
    second.systemCode === "SYS_BONE" &&
    targetIndicatorCode
  ) {
    rows.push({
      isMock: true,
      system: {
        id: "demo-bone-density",
        systemCode: second.systemCode,
        name: "骨密度",
        indicators: [{ indicator_code: targetIndicatorCode, name: "骨密度" }],
        recommendation: {
          ...second.recommendation,
          issue: "骨密度 · 活力值 90",
          indicatorScore: 90,
          eyebrow: "骨密度健康管理方案",
          title: "骨密度健康管理方案",
        },
      },
    });
  }

  return rows;
});

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

function priorityRoute(row) {
  if (row.isMock) {
    return {
      name: "indicator-detail",
      params: {
        systemId: row.system.systemCode,
        indicatorCode: row.system.recommendation.triggerIndicatorCode,
      },
      query: reportQuery,
    };
  }

  return planRoute(row.system.recommendation);
}

async function openPriority(event, row) {
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
  if (row.isMock) {
    await router.push(priorityRoute(row));
    return;
  }

  const plan = row.system.recommendation;
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
      <div>
        <h2 id="priorityPlansTitle">本次优先关注</h2>
      </div>
    </div>

    <ul class="priority-list" aria-label="优先关注指标及对应方案">
      <li
        v-for="(row, index) in priorityRows"
        :key="row.system.id"
        class="priority-item"
      >
        <div class="priority-item-content">
          <div class="priority-item-heading">
            <h3 class="priority-item-name">{{ indicatorName(row.system) }}</h3>
            <p class="priority-item-score">
              <span>活力值</span>
              <b>{{ row.system.recommendation.indicatorScore ?? "—" }}</b>
            </p>
          </div>

          <div class="priority-plan-line">
            <span class="priority-index" aria-hidden="true">{{
              String(index + 1).padStart(2, "0")
            }}</span>
            <RouterLink v-slot="{ href }" :to="priorityRoute(row)" custom>
              <a
                class="management-plan-row"
                :href="href"
                :aria-label="`${row.isMock ? '查看指标详情' : '查看方案'}：${row.system.recommendation.eyebrow || row.system.recommendation.title}`"
                @click="openPriority($event, row)"
              >
                <span class="management-plan-visual" aria-hidden="true">
                  <img
                    v-if="row.system.recommendation.image"
                    :src="row.system.recommendation.image"
                    :alt="row.system.recommendation.imageAlt"
                    width="48"
                    height="72"
                  />
                </span>
                <span class="management-plan-title">
                  {{
                    row.system.recommendation.eyebrow ||
                    row.system.recommendation.title
                  }}
                </span>
                <span class="management-plan-action">{{
                  row.isMock ? "查看详情" : "查看方案"
                }}</span>
              </a>
            </RouterLink>
          </div>
        </div>
      </li>
    </ul>

    <p class="management-plans-note">仅供日常健康管理参考</p>
  </section>
</template>

<style scoped>
.priority-plans {
  --priority-accent: #25ddd5;
  --priority-background: #09141e;
  --priority-panel: #102637;
  --priority-card: #eaf7f9;
  --priority-ink: #10243a;
  margin: 14px 12px 18px;
  padding: 16px 10px 12px;
  border-radius: 20px;
  color: #edf7f8;
  background: var(--priority-background);
}

.priority-plans-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 8px;
  padding: 0 12px;
}

.priority-plans-heading h2 {
  margin: 0;
  color: #edf7f8;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
}

.priority-list {
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid #2a4b5b;
  border-radius: 18px;
  background: var(--priority-panel);
  list-style: none;
}

.priority-item {
  padding: 8px 10px;
}

.priority-item + .priority-item {
  border-top: 1px solid #2a4b5b;
}

.priority-item-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.priority-index {
  justify-self: center;
  color: var(--priority-accent);
  font: 700 22px/1 var(--font-report-number);
  letter-spacing: 0.04em;
}

.priority-plan-line {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  margin-top: 6px;
}

.priority-item-content {
  min-width: 0;
}

.priority-item-name {
  min-width: 0;
  margin: 0;
  color: #eaf6f7;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.priority-item-score {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  color: #b5ced5;
  font-size: 12px;
}

.priority-item-score b {
  color: var(--priority-accent);
  font: 700 18px/1 var(--font-report-number);
}

.management-plan-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 74px;
  margin-top: 0;
  padding: 0 6px;
  border: 1px solid #d2e8eb;
  border-radius: 13px;
  color: var(--priority-ink);
  background: var(--priority-card);
  text-decoration: none;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}

.management-plan-row:active {
  border-color: #83d7d5;
  background: #d7eff2;
}

.management-plan-row:focus-visible {
  outline: 2px solid var(--priority-accent);
  outline-offset: 2px;
}

.management-plan-visual {
  display: grid;
  width: 42px;
  height: 63px;
  place-items: center;
  overflow: visible;
}

.management-plan-visual img {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 2 / 3;
  object-fit: contain;
  object-position: center;
}

.management-plan-title {
  min-width: 0;
  color: var(--priority-ink);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.management-plan-action {
  display: inline-grid;
  min-height: 32px;
  place-items: center;
  padding: 5px 5px;
  border-radius: 6px;
  color: #09202d;
  background: var(--priority-accent);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
}

.management-plans-note {
  margin: 9px 4px 0;
  color: #b5ced5;
  font-size: 11px;
  line-height: 1.45;
}

@media (max-width: 360px) {
  .priority-item {
    padding: 6px 8px;
  }

  .priority-plan-line {
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 6px;
  }

  .management-plan-row {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    gap: 7px;
    padding: 0 5px;
  }

  .management-plan-visual {
    width: 40px;
    height: 60px;
  }

  .management-plan-title {
    font-size: 12px;
  }
}
</style>
