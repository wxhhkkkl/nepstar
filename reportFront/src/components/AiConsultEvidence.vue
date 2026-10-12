<script setup>
import { citationToReportRoute } from '@/data/aiConsultEvidence.js'

const props = defineProps({
  items: { type: Array, default: () => [] },
  reportCode: { type: String, required: true },
  customerId: { type: Number, required: true },
  reportQuery: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['navigate'])

function routeFor(item) {
  return citationToReportRoute(item, props.reportCode, props.customerId, props.reportQuery)
}
</script>

<template>
  <details v-if="items.length" class="ai-evidence" data-testid="ai-evidence">
    <summary>查看报告依据 <span>{{ items.length }}</span></summary>
    <ol>
      <li v-for="(item, index) in items" :key="`${item.id || index}-${index}`">
        <div>
          <strong>{{ item.label }}</strong>
          <small>{{ item.source_type === 'action' ? '后台维护行动建议' : item.kind === 'maintained' ? '指标说明' : item.kind === 'plan' ? '管理方案依据' : '报告数据' }}<template v-if="item.report_date"> · 报告日期 {{ item.report_date }}</template></small>
        </div>
        <RouterLink v-if="routeFor(item)" :to="routeFor(item)" @click="emit('navigate')">查看详情</RouterLink>
      </li>
    </ol>
  </details>
</template>

<style scoped>
.ai-evidence { margin-top: 13px; border-top: 1px solid #e5edf6; padding-top: 11px; }
.ai-evidence summary { cursor: pointer; color: #557bb0; font-size: 12px; font-weight: 650; list-style: none; }
.ai-evidence summary::-webkit-details-marker { display: none; }
.ai-evidence summary span { display: inline-grid; place-items: center; min-width: 18px; height: 18px; margin-left: 5px; border-radius: 9px; background: #e8f2ff; font-size: 10px; }
.ai-evidence ol { display: grid; gap: 9px; margin: 12px 0 0; padding: 0; list-style: none; }
.ai-evidence li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 11px; border-radius: 12px; background: #f3f7fc; }
.ai-evidence strong { display: block; font-size: 12px; }
.ai-evidence small { display: block; margin-top: 4px; color: #879ab1; font-size: 10px; }
.ai-evidence a { flex: none; color: #517bb5; font-size: 11px; text-decoration: none; }
.ai-evidence a:focus-visible { outline: 2px solid #8db4ef; outline-offset: 3px; }
</style>
