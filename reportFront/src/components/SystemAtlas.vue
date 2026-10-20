<script setup>
import { computed } from 'vue'
import { buildHomeFlow, getVisibleSystems } from '@/utils/report.js'
import RecommendationCard from './RecommendationCard.vue'
import SystemCard from './SystemCard.vue'

const props = defineProps({ report: { type: Object, required: true } })
const flow = computed(() => buildHomeFlow(props.report))
const systemPositions = computed(() => new Map(
  getVisibleSystems(props.report).map((system, index) => [system.id, index + 1]),
))
</script>

<template>
  <section class="systems-section vue-flow" data-vue-flow>
    <div class="section-heading"><div><span class="eyebrow">SYSTEM ATLAS</span><h2>身体系统图谱</h2></div><span>点击任一模块查看详情</span></div>
    <template v-for="entry in flow" :key="`${entry.type}-${entry.systemId}`">
      <div v-if="entry.type === 'system-group'" class="two-grid" :data-system-group="entry.systemIds.join(',')">
        <SystemCard v-for="system in entry.systems" :key="system.id" :system="system" :display-index="systemPositions.get(system.id)" />
      </div>
      <SystemCard v-else-if="entry.type === 'system'" :system="entry.system" :display-index="systemPositions.get(entry.system.id)" />
      <RecommendationCard v-else :system="entry.system" />
    </template>
  </section>
</template>

<style scoped>
.systems-section.vue-flow .two-grid :deep(.data-card) {
  order: initial;
}

.two-grid :deep([data-system-id='endocrine']),
.two-grid :deep([data-system-id='lung']) {
  grid-column: 1 / -1;
}
</style>
