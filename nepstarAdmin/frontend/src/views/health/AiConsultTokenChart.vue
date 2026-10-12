<template>
  <VChart
    class="token-chart"
    :option="option"
    autoresize
    role="img"
    :aria-label="label"
  />
</template>
<script setup lang="ts">
import { computed } from "vue";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { AiConsultTokenPoint } from "@/api/aiConsult";
use([LineChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);
const props = defineProps<{ points: AiConsultTokenPoint[]; label: string }>();
const option = computed(() => ({
  animation: false,
  color: ["#527ed1", "#55a8a4", "#d5a45c"],
  tooltip: { trigger: "axis", renderMode: "richText", confine: true },
  legend: {
    top: 0,
    left: 0,
    icon: "roundRect",
    itemWidth: 12,
    itemHeight: 4,
    textStyle: { color: "#7c899e", fontSize: 11 },
    itemGap: 20,
  },
  grid: { left: 12, right: 12, top: 48, bottom: 8, containLabel: true },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: props.points.map((p) => p.label),
    axisLine: { lineStyle: { color: "#e8edf5" } },
    axisTick: { show: false },
    axisLabel: { color: "#94a0b2", fontSize: 10, hideOverlap: true },
  },
  yAxis: {
    type: "value",
    minInterval: 1,
    axisLabel: { color: "#94a0b2", fontSize: 10 },
    splitLine: { lineStyle: { color: "#edf1f6", type: "dashed" } },
  },
  series: [
    {
      name: "输入 token",
      type: "line",
      stack: "actual",
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.1 },
      data: props.points.map((p) => p.input_tokens),
    },
    {
      name: "输出 token",
      type: "line",
      stack: "actual",
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.1 },
      data: props.points.map((p) => p.output_tokens),
    },
    {
      name: "待回传预留",
      type: "line",
      showSymbol: false,
      connectNulls: false,
      lineStyle: { type: "dashed", width: 1.5 },
      data: props.points.map((p) => p.reserved_tokens),
    },
  ],
}));
</script>
<style scoped>
.token-chart {
  height: 260px;
  width: 100%;
}
</style>
