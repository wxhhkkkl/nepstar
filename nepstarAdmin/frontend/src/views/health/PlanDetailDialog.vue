<template>
  <el-dialog
    :model-value="visible"
    :title="$t('health.planMgmt')"
    width="720px"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div v-loading="loading" class="detail">
      <div class="head">
        <span class="name">{{ detail?.name }}</span>
        <el-tag v-if="detail" :type="detail.status === 1 ? 'success' : 'info'" size="small">
          {{ detail.status === 1 ? $t('common.enabled') : $t('common.disabled') }}
        </el-tag>
      </div>
      <p class="desc">{{ detail?.description || '-' }}</p>

      <h4>{{ $t('health.planProducts') }} ({{ detail?.products?.length || 0 }})</h4>
      <div v-if="detail?.products?.length" class="products">
        <div v-for="p in detail.products" :key="p.product_id" class="prod">
          <img v-if="p.cover_url" :src="p.cover_url" class="thumb" alt="" />
          <span>{{ p.name }}</span>
        </div>
      </div>
      <div v-else class="empty">-</div>

      <h4>{{ $t('health.planIndicators') }} ({{ detail?.indicators?.length || 0 }})</h4>
      <div v-if="groups.length" class="groups">
        <div v-for="g in groups" :key="g.indicator_id" class="group">
          <div class="l1">
            <span class="tag">{{ $t('health.level1') }}</span>
            {{ g.name }} <span class="code">({{ g.code }})</span>
            <el-tag v-if="g.status === 0" size="small" type="info">{{ $t('common.disabled') }}</el-tag>
          </div>
          <div v-for="c in g.children" :key="c.indicator_id" class="l2">
            <span class="tag l2-tag">{{ $t('health.level2') }}</span>
            {{ c.name }} <span class="code">({{ c.code }})</span>
            <el-tag v-if="c.status === 0" size="small" type="info">{{ $t('common.disabled') }}</el-tag>
          </div>
        </div>
      </div>
      <div v-else class="empty">-</div>
    </div>
    <template #footer>
      <el-button @click="emit('update:visible', false)">{{ $t('common.back') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPlan, type PlanDetail, type PlanIndicatorLink } from '@/api/health'

const props = defineProps<{ visible: boolean; plan: any }>()
const emit = defineEmits<{ 'update:visible': [boolean] }>()

const detail = ref<PlanDetail | null>(null)
const loading = ref(false)

/** Group level-2 items under their level-1 category (FR-305), preserving API order. */
const groups = computed(() => {
  const inds: PlanIndicatorLink[] = detail.value?.indicators || []
  const byParent = new Map<number, PlanIndicatorLink[]>()
  for (const i of inds) {
    if (i.level !== 2 || i.parent_id == null) continue
    const list = byParent.get(i.parent_id) || []
    list.push(i)
    byParent.set(i.parent_id, list)
  }
  return inds
    .filter((i) => i.level === 1)
    .map((cat) => ({ ...cat, children: byParent.get(cat.indicator_id) || [] }))
})

async function load() {
  if (!props.plan?.id) return
  loading.value = true
  try {
    detail.value = (await fetchPlan(props.plan.id)).data
  } catch (e: any) {
    ElMessage.error(e?.message || 'health.operationFailed')
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (v) => { if (v) load() }, { immediate: true })
</script>

<style scoped>
.detail { min-height: 120px; }
.head { display: flex; align-items: center; gap: 10px; }
.name { font-size: 16px; font-weight: 600; }
.desc { color: #64748b; margin: 6px 0 14px; }
h4 { margin: 14px 0 8px; font-size: 13px; color: #334155; }
.products { display: flex; flex-wrap: wrap; gap: 10px; }
.prod { display: flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 10px 4px 4px; }
.thumb { width: 36px; height: 28px; object-fit: cover; border-radius: 5px; }
.groups { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
.group + .group { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; }
.l1 { font-weight: 600; display: flex; align-items: center; gap: 6px; }
.l2 { margin: 5px 0 0 18px; color: #475569; display: flex; align-items: center; gap: 6px; }
.tag { font-size: 11px; padding: 1px 6px; border-radius: 8px; background: #eff6ff; color: #3b82f6; }
.l2-tag { background: #f0fdf4; color: #16a34a; }
.code { color: #94a3b8; font-size: 12px; }
.empty { color: #94a3b8; }
</style>
