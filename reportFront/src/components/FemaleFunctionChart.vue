<script setup>
import { computed } from 'vue'
import { useCardReveal } from '@/composables/useCardReveal.js'
import { scoreAppearance, scoreStyle } from '@/utils/scoreColor.js'

const props = defineProps({
  system: { type: Object, required: true },
  variant: { type: String, default: 'card' },
})
const emit = defineEmits(['indicator-click'])
const { element, isVisible } = useCardReveal()

const metrics = computed(() => {
  const items = props.system.indicators?.length
    ? props.system.indicators
    : (props.system.visualization?.categories || []).map((name, index) => ({
        name, score: props.system.visualization?.series?.[index],
      }))
  const innerRadius = props.variant === 'detail' ? 52 : 44
  const spacing = items.length > 1 ? (84 - innerRadius) / (items.length - 1) : 0
  return items.map((item, index) => ({
    key: item.indicator_code || `${item.name}-${index}`,
    indicator: item,
    name: item.name || `指标 ${index + 1}`,
    score: typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : null,
    color: scoreAppearance(item.score).color,
    radius: items.length === 1 ? 76 : 84 - index * spacing,
    stroke: items.length === 1 ? 12 : Math.max(2, Math.min(12, spacing * .65)),
  }))
})
</script>

<template>
  <div ref="element" class="female-overview" :class="{ 'female-overview--detail': variant === 'detail', 'is-visible': isVisible }" :style="scoreStyle(system.score)" :data-score-level="scoreAppearance(system.score).key">
    <div class="female-rings" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <g v-for="(item, index) in metrics" :key="item.key" :style="{ '--metric-color': item.color, '--ring-fill': `${Math.min(100, Math.max(0, item.score ?? 0))} 100`, '--ring-delay': `${100 + index * 140}ms` }">
          <circle class="female-ring-track" cx="100" cy="100" :r="item.radius" :stroke-width="item.stroke" />
          <circle v-if="item.score !== null && item.score > 0" class="female-ring-progress" cx="100" cy="100" :r="item.radius" :stroke-width="item.stroke" pathLength="100" :stroke-dasharray="`${Math.min(100, Math.max(0, item.score))} 100`" transform="rotate(-90 100 100)" />
        </g>
      </svg>
      <div class="female-rings-center"><strong class="score-value">{{ system.score ?? '—' }}</strong><span>活力值</span></div>
    </div>
    <ul v-if="metrics.length" class="female-indicators" aria-label="女性功能指标活力值，满分 100 分">
      <li v-for="item in metrics" :key="item.key" :style="{ ...scoreStyle(item.score), '--metric-color': item.color }">
        <button
          v-if="variant === 'detail'"
          type="button"
          class="female-indicator-button"
          :aria-label="`查看${item.name}详情`"
          :disabled="!item.indicator?.indicator_code"
          @click="emit('indicator-click', item.indicator)"
        >
          <span class="female-indicator-label"><i aria-hidden="true" />{{ item.name }}</span>
          <span class="female-indicator-score"><strong class="score-value">{{ item.score ?? '—' }}</strong><small>{{ item.score === null ? '未提供' : '/100' }}</small></span>
        </button>
        <template v-else>
          <span class="female-indicator-label"><i aria-hidden="true" />{{ item.name }}</span>
          <span class="female-indicator-score"><strong class="score-value">{{ item.score ?? '—' }}</strong><small>{{ item.score === null ? '未提供' : '/100' }}</small></span>
        </template>
      </li>
    </ul>
    <p v-else class="female-indicators-empty">暂无子项指标</p>
  </div>
</template>

<style scoped>
.female-overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  align-items: center;
  gap: 18px;
  margin-top: 24px;
  padding-block: 4px 10px;
}

.female-rings {
  position: relative;
  width: 100%;
  max-width: 172px;
  margin-inline: auto;
  aspect-ratio: 1;
}

.female-rings svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
}

.female-ring-track {
  stroke: var(--metric-color);
  opacity: .13;
}

.female-ring-progress {
  stroke: var(--metric-color);
  stroke-linecap: round;
  stroke-dasharray: 0 100;
  opacity: 0;
}

.female-overview.is-visible .female-ring-progress {
  animation: female-ring-draw 1.1s var(--ring-delay) cubic-bezier(.22, .75, .3, 1) both;
}

@keyframes female-ring-draw {
  from {
    stroke-dasharray: 0 100;
    opacity: 0;
  }

  to {
    stroke-dasharray: var(--ring-fill);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .female-overview .female-ring-progress,
  .female-overview.is-visible .female-ring-progress {
    animation: none;
    stroke-dasharray: var(--ring-fill);
    opacity: 1;
  }
}

.female-rings-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.female-rings-center strong {
  color: #253754;
  font: 700 clamp(22px, 6vw, 28px)/1 var(--font-report-number);
  font-variant-numeric: tabular-nums;
}

.female-rings-center span {
  color: #8391a6;
  font-size: 10px;
  line-height: 1.3;
}

.female-indicators {
  display: grid;
  gap: 0;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.female-indicators li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding-block: 13px;
}

.female-indicators li + li {
  border-top: 1px solid rgba(109, 132, 164, .1);
}

.female-indicator-label {
  position: relative;
  min-width: 0;
  padding-left: 13px;
  color: #536780;
  font-size: var(--report-indicator-label-size);
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.female-indicator-label i {
  position: absolute;
  left: 0;
  top: .47em;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--metric-color);
}

.female-indicator-score {
  display: flex;
  align-items: baseline;
  gap: 2px;
  white-space: nowrap;
}

.female-indicator-score strong {
  color: var(--metric-color);
  font: 700 17px/1.2 var(--font-report-number);
  font-variant-numeric: tabular-nums;
}

.female-indicator-score small {
  color: #94a0b1;
  font-size: 10px;
}

.female-overview--detail .female-indicators li {
  display: block;
  padding-block: 0;
}

.female-indicator-button {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding-block: 13px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.female-indicator-button:focus-visible {
  outline: 3px solid rgba(38, 157, 164, .5);
  outline-offset: 2px;
}

.female-indicator-button:disabled {
  cursor: default;
}

.female-indicators-empty {
  color: #8391a6;
  font-size: 12px;
  line-height: 1.5;
}

.female-overview--detail {
  grid-template-columns: minmax(156px, 1.12fr) minmax(0, 1fr);
  gap: 14px;
  margin-top: 0;
  padding-block: 10px;
}

.female-overview--detail .female-rings {
  max-width: 204px;
}

.female-overview--detail .female-rings-center {
  gap: 6px;
}

.female-overview--detail .female-rings-center strong {
  font-size: 28px;
}

.female-overview--detail .female-rings-center span {
  font-size: 11px;
  line-height: 1.3;
}

@media (max-width: 374px) {
  .female-overview {
    grid-template-columns: minmax(0, .85fr) minmax(0, 1.4fr);
    gap: 12px;
  }

  .female-rings-center strong {
    font-size: 18px;
  }

  .female-rings-center {
    gap: 3px;
  }

  .female-rings-center span {
    font-size: 8px;
    line-height: 1;
  }

  .female-indicator-score strong {
    font-size: 16px;
  }
}

/* 详情页内层空间更窄，小屏改为上下结构，名称仍横向完整展示。 */
@media (max-width: 389px) {
  .female-overview--detail {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding-block: 4px;
  }

  .female-overview--detail .female-rings {
    width: 204px;
    max-width: 100%;
  }

  .female-overview--detail .female-indicators li {
    padding-block: 0;
  }
}
</style>
