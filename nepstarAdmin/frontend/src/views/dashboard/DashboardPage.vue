<template>
  <div class="dashboard">
    <h2 class="page-title">{{ $t('menu.dashboard') }}</h2>

    <!-- KPI 卡片 -->
    <el-row :gutter="20" class="stats">
      <el-col :span="8">
        <div class="stat-card dev" @click="$router.push('/device/list')">
          <div class="stat-value">{{ fmt(deviceCount) }}</div>
          <div class="stat-label">{{ $t('dashboard.totalDevices') }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card ins" @click="$router.push('/report/list')">
          <div class="stat-value">{{ fmt(reportCount) }}</div>
          <div class="stat-label">{{ $t('dashboard.totalInspections') }}</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card cust" @click="$router.push('/customer/list')">
          <div class="stat-value">{{ fmt(customerCount) }}</div>
          <div class="stat-label">{{ $t('dashboard.customerCount') || '总用户数' }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- 时间筛选 -->
    <div class="filter-bar">
      <el-radio-group v-model="period" @change="onPeriodChange" size="small">
        <el-radio-button value="7d">{{ $t('dashboard.last7d') || '近7天' }}</el-radio-button>
        <el-radio-button value="30d">{{ $t('dashboard.last30d') || '近30天' }}</el-radio-button>
        <el-radio-button value="90d">{{ $t('dashboard.last90d') || '近90天' }}</el-radio-button>
        <el-radio-button value="custom">{{ $t('dashboard.custom') || '自定义' }}</el-radio-button>
      </el-radio-group>
      <el-date-picker
        v-if="period === 'custom'"
        v-model="customRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        size="small"
        style="margin-left: 12px; width: 260px"
        @change="onPeriodChange"
      />
    </div>

    <!-- 趋势图 -->
    <el-row :gutter="20" class="charts" v-loading="chartLoading">
      <el-col :span="12">
        <div class="chart-card">
          <h3 class="chart-title">{{ $t('dashboard.reportTrend') || '报告数趋势' }}</h3>
          <v-chart :option="reportChartOption" style="height: 300px" autoresize />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <h3 class="chart-title">{{ $t('dashboard.customerTrend') || '用户数趋势' }}</h3>
          <v-chart :option="customerChartOption" style="height: 300px" autoresize />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { getDashboard, type TrendPoint } from '@/api/dashboard';

use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const deviceCount = ref(0);
const reportCount = ref(0);
const customerCount = ref(0);
const trendPoints = ref<TrendPoint[]>([]);
const period = ref('30d');
const customRange = ref<string[] | null>(null);
const chartLoading = ref(false);

function fmt(n: number) {
  return n.toLocaleString();
}

function getDateRange(): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  let start = end;
  if (period.value === '7d') {
    start = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  } else if (period.value === '30d') {
    start = new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10);
  } else if (period.value === '90d') {
    start = new Date(now.getTime() - 90 * 864e5).toISOString().slice(0, 10);
  } else if (period.value === 'custom' && customRange.value) {
    return { start: customRange.value[0], end: customRange.value[1] };
  }
  return { start, end };
}

async function fetchData() {
  chartLoading.value = true;
  try {
    const { start, end } = getDateRange();
    const r = await getDashboard({ start_date: start, end_date: end });
    const d = r.data;
    deviceCount.value = d.stats.device_count;
    reportCount.value = d.stats.report_count;
    customerCount.value = d.stats.customer_count;
    trendPoints.value = d.trend.points || [];
  } catch {
    // keep last values
  } finally {
    chartLoading.value = false;
  }
}

function onPeriodChange() {
  if (period.value !== 'custom') fetchData();
  else if (customRange.value) fetchData();
}

function makeChartOption(title: string, key: 'report_count' | 'customer_count') {
  const labels = trendPoints.value.map((p) => p.label);
  const data = trendPoints.value.map((p) => p[key]);
  return {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 40, right: 16, top: 16, bottom: 24 },
    xAxis: { type: 'category' as const, data: labels, axisLabel: { rotate: labels.length > 15 ? 45 : 0 } },
    yAxis: { type: 'value' as const, minInterval: 1 },
    series: [{
      name: title,
      type: 'bar',
      data,
      barMaxWidth: 28,
      itemStyle: {
        color: key === 'report_count' ? '#6969e8' : '#18a999',
        borderRadius: [7, 7, 0, 0],
      },
    }],
  };
}

const reportChartOption = computed(() => makeChartOption('报告数', 'report_count'));
const customerChartOption = computed(() => makeChartOption('用户数', 'customer_count'));

onMounted(fetchData);
</script>

<style scoped>
.dashboard { max-width: 1400px; }
.page-title { font-size: 22px; font-weight: 600; color: #1e293b; margin-bottom: 24px; }
.stats { margin-bottom: 24px; }
.stat-card { position: relative; overflow: hidden; background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 26px 24px; cursor: pointer; transition: transform .3s var(--ease), box-shadow .3s var(--ease); box-shadow: var(--shadow-sm); }
.stat-card::after { position: absolute; right: -28px; bottom: -42px; width: 125px; height: 125px; border-radius: 50%; background: currentColor; opacity: .055; content: ""; transition: transform .35s var(--ease); }
.stat-card:hover { transform: translateY(-5px); box-shadow: var(--shadow); }
.stat-card:hover::after { transform: scale(1.2); }
.stat-value { font-size: 34px; font-weight: 760; color: #24263b; letter-spacing: -.04em; }
.stat-label { font-size: 14px; color: #64748b; margin-top: 4px; }
.stat-card.dev { color: #6969e8; border-top: 3px solid #6969e8; }
.stat-card.ins { color: #18a999; border-top: 3px solid #18a999; }
.stat-card.cust { color: #e59b35; border-top: 3px solid #e59b35; }
.filter-bar { background: #fff; border-radius: 12px; padding: 16px 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.06); display: flex; align-items: center; }
.charts { margin-top: 16px; }
.chart-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.chart-title { font-size: 15px; font-weight: 600; color: #1e293b; margin: 0 0 12px 0; }
@media (max-width: 900px) {
  .stats .el-col, .charts .el-col { max-width: 100%; flex: 0 0 100%; margin-bottom: 14px; }
  .filter-bar { overflow-x: auto; padding: 12px !important; }
}
</style>
