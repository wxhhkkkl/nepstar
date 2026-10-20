<script setup>
import { computed } from 'vue'
import { citationToReportRoute } from '@/data/aiConsultEvidence.js'

const props = defineProps({
  answer: { type: String, default: '' },
  evidence: { type: Array, default: () => [] },
  streaming: { type: Boolean, default: false },
  reportCode: { type: String, required: true },
  customerId: { type: Number, required: true },
})

// Only turn the server's canonical, cited report-fact lines into score cards.
// Other numbers (including model prose, dosages and percentages) stay plain text.
const blocks = computed(() => {
  if (props.streaming) return [{ type: 'text', text: props.answer }]
  const lines = props.answer.split('\n')
  const result = []
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue
    const fact = line.match(/^报告日期 (\d{4}-\d{2}-\d{2})：(.+?)活力值 (\d{1,3}) 分。$/)
    const source = fact && props.evidence.find(item => item.kind === 'report' && item.label === fact[2]
      && item.report_date === fact[1] && citationToReportRoute(item, props.reportCode, props.customerId))
    if (source && Number(fact[3]) <= 100) {
      const metric = { label: fact[2], score: Number(fact[3]), date: fact[1], original: line }
      const previous = result.at(-1)
      if (previous?.type === 'metrics') previous.items.push(metric)
      else result.push({ type: 'metrics', items: [metric] })
      continue
    }
    const bullet = line.match(/^(?:([1-9]\d?)[.、．]\s*|[-•]\s+)(.+)$/)
    if (bullet) {
      const previous = result.at(-1)
      const item = { number: bullet[1], text: bullet[2] }
      if (previous?.type === 'list') previous.items.push(item)
      else result.push({ type: 'list', items: [item] })
      continue
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/)
    const shortLead = index === 0 && lines.length > 1 && line.length <= 28 && !/[。！？.!?：:]$/.test(line)
    result.push({ type: heading || shortLead ? 'heading' : 'text', text: heading ? heading[1] : line })
  }
  return result
})
</script>

<template>
  <div class="ai-answer-text" :class="{ 'ai-answer-text--streaming': streaming }">
    <template v-for="(block, index) in blocks" :key="index">
      <h2 v-if="block.type === 'heading'">{{ block.text }}</h2>
      <div v-else-if="block.type === 'metrics'" class="ai-answer-metrics" data-testid="ai-answer-metrics">
        <div v-for="(metric, metricIndex) in block.items" :key="`${metric.label}-${metricIndex}`" class="ai-answer-metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.score }}</strong>
          <span class="ai-visually-hidden">{{ metric.original }}</span>
        </div>
      </div>
      <ol v-else-if="block.type === 'list'" class="ai-answer-list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex"><span aria-hidden="true">{{ item.number || itemIndex + 1 }}</span><p>{{ item.text }}</p></li>
      </ol>
      <p v-else>{{ block.text }}</p>
    </template>
  </div>
</template>

<style scoped>
.ai-answer-text { color: #3e5980; font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; }
.ai-answer-text p { margin: 0; white-space: pre-wrap; }
.ai-answer-text > * + * { margin-top: 12px; }
.ai-answer-text h2 { margin: 0; color: #172e51; font-size: 18px; line-height: 1.6; font-weight: 750; }
.ai-answer-text > h2:not(:first-child) { margin-top: 16px; }
.ai-answer-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.ai-answer-metric { display: flex; flex-direction: column; min-width: 0; padding: 14px 8px; border-radius: 15px; background: #edf8f4; }
.ai-answer-metric:nth-child(3n + 2) { background: #eef5ff; }
.ai-answer-metric:nth-child(3n) { background: #f4efff; }
.ai-answer-metric > span:first-child { display: block; color: #2e4a6d; font-size: 14px; line-height: 1.5; }
.ai-answer-metric > strong { display: block; margin-top: auto; padding-top: 3px; color: #159176; font-size: 26px; font-weight: 750; line-height: 1.2; }
.ai-answer-metric:nth-child(3n + 2) > strong { color: #3a7de8; }
.ai-answer-metric:nth-child(3n) > strong { color: #8c6cda; }
.ai-answer-list { display: grid; gap: 9px; padding: 0; margin-bottom: 0; list-style: none; }
.ai-answer-list li { display: flex; align-items: baseline; gap: 9px; }
.ai-answer-list li > span { display: grid; place-items: center; min-width: 25px; height: 25px; flex: none; border-radius: 50%; background: #dff5eb; color: #1a9a78; font-weight: 700; }
.ai-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.ai-answer-text--streaming > p:last-child::after { content: ''; display: inline-block; width: 3px; height: 1em; margin-left: 5px; transform: translateY(2px); background: #4689ff; animation: ai-cursor 1s steps(2, jump-none) infinite; }
@keyframes ai-cursor { 0%, 100% { opacity: 1; } 50% { opacity: .2; } }
@media (max-width: 359px) { .ai-answer-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .ai-answer-text--streaming > p:last-child::after { animation: none; } }
</style>
