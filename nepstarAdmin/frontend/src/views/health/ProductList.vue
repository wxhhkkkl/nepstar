<template>
  <div class="page">
    <h2 class="page-title">{{ $t('health.productMgmt') }}</h2>
    <div class="card">
      <div class="tb">
        <el-input v-model="kw" :placeholder="$t('health.searchProduct')" style="width: 260px" clearable @input="fetchList" />
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          {{ $t('health.productCreate') }}
        </el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe :empty-text="$t('common.noData')">
        <el-table-column :label="$t('health.cover')" width="90">
          <template #default="{ row }">
            <img v-if="row.cover_url" :src="row.cover_url" class="cover" alt="" />
            <span v-else class="no-cover">-</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('health.productName')" prop="name" min-width="160" />
        <el-table-column :label="$t('health.productDesc')" min-width="200">
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column :label="$t('common.status')" width="90" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.status" :active-value="1" :inactive-value="0" @change="(v: number) => toggleStatus(row, v)" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.operation')" width="150" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openEdit(row)">{{ $t('common.edit') }}</el-button>
            <el-popconfirm :title="$t('health.productConfirmDelete')" @confirm="handleDelete(row.id)">
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

    <ProductEditDialog v-if="dialogVisible" v-model:visible="dialogVisible" :product="editing" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { deleteProduct, fetchProducts, updateProduct, type ProductListItem } from '@/api/health'
import ProductEditDialog from './ProductEditDialog.vue'

const { t } = useI18n()

const list = ref<ProductListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const kw = ref('')

const dialogVisible = ref(false)
const editing = ref<ProductListItem | null>(null)

function errText(key?: string): string {
  if (!key) return t('health.operationFailed')
  const msg = t(`health.${key}`)
  return msg.startsWith('health.') ? t('health.operationFailed') : msg
}

async function fetchList() {
  loading.value = true
  try {
    const r = await fetchProducts({ page: page.value, page_size: pageSize.value, keyword: kw.value })
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

function openEdit(row: ProductListItem) {
  editing.value = row
  dialogVisible.value = true
}

async function onSaved() {
  await fetchList()
}

async function toggleStatus(row: ProductListItem, value: number) {
  const prev = row.status
  row.status = value
  try {
    await updateProduct(row.id, { status: value })
  } catch (e: any) {
    row.status = prev
    ElMessage.error(errText(e?.message))
  }
}

async function handleDelete(id: number) {
  try {
    await deleteProduct(id)
    ElMessage.success(t('health.productDeleteSuccess'))
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
.cover { width: 56px; height: 42px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; }
.no-cover { color: #94a3b8; }
</style>
