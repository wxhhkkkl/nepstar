<template>
  <div class="page">
    <h2 class="page-title">{{ $t('health.planMgmt') }}</h2>
    <div class="card">
      <div class="tb">
        <el-input v-model="kw" :placeholder="$t('health.searchPlan')" style="width: 260px" clearable @input="fetchList" />
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          {{ $t('health.planCreate') }}
        </el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe :empty-text="$t('common.noData')">
        <el-table-column :label="$t('health.planName')" prop="name" min-width="160" />
        <el-table-column :label="$t('health.planDesc')" min-width="220">
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column :label="$t('health.planProducts')" width="110" align="center">
          <template #default="{ row }">
            <span class="count-badge">{{ row.product_count }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('health.planIndicators')" width="110" align="center">
          <template #default="{ row }">
            <span class="count-badge ind">{{ row.indicator_count }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.status')" width="90" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.status" :active-value="1" :inactive-value="0" @change="(v: number) => toggleStatus(row, v)" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.operation')" width="150" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openEdit(row)">{{ $t('common.edit') }}</el-button>
            <el-popconfirm :title="$t('health.planConfirmDelete')" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button text type="danger" size="small">{{ $t('common.delete') }}</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          :total="total" v-model:current-page="page" :page-size="pageSize"
          layout="prev,pager,next" @change="fetchList" background
        />
      </div>
    </div>

    <PlanEditDialog v-if="dialogVisible" v-model:visible="dialogVisible" :plan="editing" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { deletePlan, fetchPlans, updatePlan, type PlanListItem } from '@/api/health'
import PlanEditDialog from './PlanEditDialog.vue'

const { t } = useI18n()

const list = ref<PlanListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const kw = ref('')

const dialogVisible = ref(false)
const editing = ref<PlanListItem | null>(null)

function errText(key?: string): string {
  if (!key) return t('health.operationFailed')
  const msg = t(`health.${key}`)
  return msg.startsWith('health.') ? t('health.operationFailed') : msg
}

async function fetchList() {
  loading.value = true
  try {
    const r = await fetchPlans({ page: page.value, page_size: pageSize.value, keyword: kw.value })
    list.value = r.data.records
    total.value = r.data.total
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  dialogVisible.value = true
}

function openEdit(row: PlanListItem) {
  editing.value = row
  dialogVisible.value = true
}

async function onSaved() {
  await fetchList()
}

async function toggleStatus(row: PlanListItem, value: number) {
  const prev = row.status
  row.status = value
  try {
    await updatePlan(row.id, { status: value })
  } catch (e: any) {
    row.status = prev
    ElMessage.error(errText(e?.message))
  }
}

async function handleDelete(id: number) {
  try {
    await deletePlan(id)
    ElMessage.success(t('health.planDeleteSuccess'))
    await fetchList()
  } catch (e: any) {
    ElMessage.error(errText(e?.message))
  }
}

onMounted(fetchList)
</script>

<style scoped>
.page { max-width: 1400px; }
.page-title { font-size: 22px; font-weight: 600; color: #1e293b; margin-bottom: 20px; }
.card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04); }
.tb { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
.count-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 24px; height: 22px; padding: 0 6px; border-radius: 11px;
  background: #e2e8f0; color: #64748b; font-size: 12px; font-weight: 500;
}
.count-badge.ind { background: #f0fdf4; color: #16a34a; }
</style>
