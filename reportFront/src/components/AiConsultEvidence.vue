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
    <summary>
      <svg class="ai-source-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h5" /></svg>
      <span class="ai-source-label">依据：{{ items.find(item => item.kind === 'report')?.label || items[0].label }}</span>
      <span class="ai-source-action">查看依据<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></span>
      <span class="ai-source-sr">查看报告依据，共 {{ items.length }} 项</span>
    </summary>
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
.ai-evidence { margin-top: 15px; }
.ai-evidence summary { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; padding: 10px; border: 1px solid #edf3ff; border-radius: 13px; background: #eff5ff; cursor: pointer; color: #5278b4; font-size: var(--ai-font-caption, 14px); font-weight: 500; line-height: 1.6; list-style: none; }
.ai-evidence summary::-webkit-details-marker { display: none; }
.ai-source-icon { width: 18px; height: 18px; flex: none; color: #4a8cff; }
.ai-source-label { min-width: 0; flex: 1; overflow-wrap: anywhere; }
.ai-source-action { display: flex; align-items: center; gap: 2px; margin-left: auto; color: #5e769c; white-space: nowrap; }
.ai-source-action svg { width: 14px; height: 14px; transition: transform .2s; }
.ai-evidence[open] .ai-source-action svg { transform: rotate(90deg); }
.ai-source-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.ai-evidence ol { display: grid; gap: 9px; margin: 12px 0 0; padding: 0; list-style: none; }
.ai-evidence li { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 10px 11px; border-radius: 12px; background: #f3f7fc; }
.ai-evidence li>div { min-width: 0; overflow-wrap: anywhere; }
.ai-evidence strong { display: block; font-size: var(--ai-font-caption, 14px); }
.ai-evidence small { display: block; margin-top: 4px; color: #63758e; font-size: var(--ai-font-caption, 14px); line-height: 1.6; }
.ai-evidence a { flex: none; color: #517bb5; font-size: var(--ai-font-caption, 14px); text-decoration: none; white-space: nowrap; }
.ai-evidence a:focus-visible { outline: 2px solid #8db4ef; outline-offset: 3px; }
.ai-evidence summary:focus-visible { outline: 2px solid #8db4ef; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .ai-source-action svg { transition: none; } }
</style>
