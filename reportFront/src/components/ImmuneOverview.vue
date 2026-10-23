<script setup>
import { computed } from "vue";
import { useCardReveal } from "@/composables/useCardReveal.js";
import { clampScore } from "@/utils/chartGeometry.js";
import { scoreAppearance, scoreStyle } from "@/utils/scoreColor.js";

const props = defineProps({
  system: { type: Object, required: true },
  indexLabel: { type: String, required: true },
});
// The lower chart enters view after the card header on small screens.
const { element: scoresElement, isVisible: scoresVisible } = useCardReveal();

const metrics = computed(() => {
  const items = props.system.indicators?.length
    ? props.system.indicators
    : (props.system.visualization?.categories ?? []).map((name, index) => ({
        name,
        score: props.system.visualization?.series?.[index],
      }));
  return items.map((item, index) => ({
    key: item.indicator_code || `${item.name}-${index}`,
    name: item.name || `指标 ${index + 1}`,
    label: (item.name || `指标 ${index + 1}`).replace(/(.+)(免疫力|球蛋白|功能)$/, '$1\n$2'),
    score:
      typeof item.score === "number" && Number.isFinite(item.score)
        ? item.score
        : null,
  }));
});
</script>

<template>
  <div class="immune-overview">
    <div class="immune-original-summary">
      <div class="immune-copy">
        <div class="card-index">{{ indexLabel }} / IMMUNITY</div>
        <h3>{{ system.name }}</h3>
        <strong class="score-value">{{ system.score ?? "—" }}</strong>
        <span>{{ scoreAppearance(system.score).label }}</span>
        <p>各项指标活力值如下，可点击查看详情。</p>
      </div>
      <div
        class="immune-map"
        role="img"
        :aria-label="`免疫力雷达图，综合活力值 ${system.score ?? '未提供'}`"
      >
        <svg viewBox="0 0 210 210" aria-hidden="true">
          <path
            class="network"
            d="M105 35 166 70 164 139 105 175 45 140 44 70Z M105 35 105 105 166 70M105 105 164 139M105 105 105 175M105 105 45 140M105 105 44 70"
          />
          <circle cx="105" cy="105" r="28" />
          <circle
            class="score-node"
            cx="105"
            cy="35"
            r="9"
            :style="scoreStyle(system.visualization.series[0])"
          />
          <circle
            class="score-node"
            cx="166"
            cy="70"
            r="8"
            :style="scoreStyle(system.visualization.series[1])"
          />
          <circle
            class="score-node"
            cx="164"
            cy="139"
            r="9"
            :style="scoreStyle(system.visualization.series[2])"
          />
          <circle
            class="score-node"
            cx="105"
            cy="175"
            r="8"
            :style="scoreStyle(system.visualization.series[3])"
          />
          <circle
            class="score-node"
            cx="45"
            cy="140"
            r="9"
            :style="scoreStyle(system.visualization.series[4])"
          />
          <circle
            class="score-node"
            cx="44"
            cy="70"
            r="8"
            :style="scoreStyle(system.visualization.series[5])"
          />
        </svg>
        <span class="map-center score-value">{{ system.score ?? "—" }}</span>
      </div>
    </div>
    <div ref="scoresElement" class="immune-scores" :class="{ 'is-visible': scoresVisible }">
      <p class="immune-scores-heading">
        {{ metrics.length }} 项指标 · 满分 100
      </p>
      <ul
        v-if="metrics.length"
        class="immune-metrics"
        aria-label="免疫力各项指标活力值，满分 100 分"
      >
        <li
          v-for="(item, index) in metrics"
          :key="item.key"
          class="immune-metric"
          :style="{ ...scoreStyle(item.score), '--immune-delay': `${index * 90}ms` }"
          :aria-label="`${item.name}：${item.score ?? '未提供'}${item.score === null ? '' : ' 分'}`"
        >
          <strong class="immune-metric-value score-value">{{
            item.score ?? "—"
          }}</strong>
          <div class="immune-bar-track" aria-hidden="true">
            <i :style="{ height: `${clampScore(item.score)}%` }" />
          </div>
          <span class="immune-metric-name">{{ item.label }}</span>
        </li>
      </ul>
      <p v-else>暂无子项指标</p>
      <p class="immune-caption">各子项活力值越高，表现越好</p>
    </div>
  </div>
</template>

<style scoped>
.immune-overview {
  min-width: 0;
}

.immune-original-summary {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr);
  align-items: center;
  min-height: 290px;
}

.immune-scores {
  padding-top: 20px;
  border-top: 1px solid rgba(83, 103, 128, 0.14);
}

.immune-overview .immune-scores-heading {
  margin: 0 0 20px;
  color: #697a8c;
  font-size: 13px;
  line-height: 1.5;
}

.immune-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.immune-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
}

.immune-metric-value {
  color: var(--score-color);
  font: 700 22px/1.2 var(--font-report-number);
  font-variant-numeric: tabular-nums;
}

.immune-bar-track {
  display: flex;
  align-items: flex-end;
  width: 30px;
  max-width: 70%;
  height: 115.2px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 99px;
  background: #dfe7eb;
}

.immune-bar-track i {
  width: 100%;
  border-radius: inherit;
  background: var(--score-color);
  transform: scaleY(0);
  transform-origin: center bottom;
}

.immune-scores.is-visible .immune-bar-track i {
  animation: immune-bar-grow 900ms var(--immune-delay) cubic-bezier(.22, .75, .3, 1) both;
}

.immune-scores.is-visible .immune-metric-value {
  animation: immune-value-in 550ms var(--immune-delay) ease-out both;
}

@keyframes immune-bar-grow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

@keyframes immune-value-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .immune-bar-track i,
  .immune-scores.is-visible .immune-bar-track i,
  .immune-scores.is-visible .immune-metric-value {
    animation: none;
    transform: none;
    opacity: 1;
  }
}

.immune-metric-name {
  display: block;
  width: 100%;
  min-height: 2.8em;
  margin-top: 12px;
  color: #536780;
  font-size: var(--report-indicator-label-size);
  font-weight: 500;
  line-height: 1.4;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.immune-overview .immune-caption {
  margin: 20px 0 0;
  color: #697a8c;
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 389px) {
  .immune-original-summary {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .immune-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px 12px;
  }
}
</style>
