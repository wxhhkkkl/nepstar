<template>
  <div class="page">
    <h2 class="page-title">{{ $t('health.indicatorMgmt') }}</h2>
    <div class="card">
      <div class="tb">
        <el-input v-model="kw" :placeholder="$t('health.searchPlaceholder')" style="width: 260px" clearable @input="fetchList" />
        <el-button type="primary" @click="openCreate(null)">
          <el-icon><Plus /></el-icon>
          {{ $t('health.addLevel1') }}
        </el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe :empty-text="$t('common.noData')" row-key="id">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="child-list">
              <div v-if="!row.children || !row.children.length" class="child-empty">{{ $t('health.noChildren') }}</div>
              <div v-for="c in row.children" :key="c.id" class="child-row">
                <span class="lvl-tag l2">{{ $t('health.level2') }}</span>
                <span class="child-name">{{ c.name }}</span>
                <span class="child-code">{{ c.code }}</span>
                <span class="child-desc">{{ c.description || '-' }}</span>
                <el-switch :model-value="c.status" :active-value="1" :inactive-value="0" @change="(v: number) => toggleStatus(c, v)" />
                <span class="ops">
                  <el-button text type="primary" size="small" @click="openEditChild(c)">{{ $t('common.edit') }}</el-button>
                  <el-popconfirm :title="$t('health.confirmDelete')" @confirm="handleDelete(c.id)">
                    <template #reference>
                      <el-button text type="danger" size="small">{{ $t('common.delete') }}</el-button>
                    </template>
                  </el-popconfirm>
                </span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('health.name')" min-width="180">
          <template #default="{ row }">
            <span class="lvl-tag l1">{{ $t('health.level1') }}</span>
            <span class="row-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('health.code')" prop="code" width="140" />
        <el-table-column :label="$t('health.description')" min-width="160">
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column :label="$t('common.status')" width="90" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.status" :active-value="1" :inactive-value="0" @change="(v: number) => toggleStatus(row, v)" />
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.operation')" width="220" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openCreate(row)">{{ $t('health.addChild') }}</el-button>
            <el-button text type="primary" size="small" @click="openEditRow(row)">{{ $t('common.edit') }}</el-button>
            <el-popconfirm :title="$t('health.confirmDelete')" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button text type="danger" size="small">{{ $t('common.delete') }}</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item v-if="level2" :label="$t('health.level1')">
          <el-input :model-value="parentName" disabled />
        </el-form-item>
        <el-form-item :label="$t('health.name')" prop="name">
          <el-input v-model="form.name" maxlength="100" />
        </el-form-item>
        <el-form-item :label="$t('health.code')" prop="code">
          <el-input v-model="form.code" maxlength="50" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item :label="$t('health.description')">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
        <el-form-item :label="$t('health.sort')">
          <el-input-number v-model="form.sort_order" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="$t('common.status')">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { IndicatorNode } from '@/api/health'
import { createIndicator, deleteIndicator, fetchIndicatorTree, updateIndicator } from '@/api/health'

const { t } = useI18n()

const list = ref<IndicatorNode[]>([])
const loading = ref(false)
const kw = ref('')

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const parentId = ref<number | null>(null) // null => level-1 (create)
const parentName = ref('')
const submitting = ref(false)
const formRef = ref<FormInstance>()

const form = ref({ name: '', code: '', description: '', sort_order: 0, status: 1 })

const rules: FormRules = {
  name: [{ required: true, message: t('health.nameRequired'), trigger: 'blur' }],
  code: [{ required: true, message: t('health.codeRequired'), trigger: 'blur' }],
}

const level2 = computed(() => (editingId.value === null && parentId.value !== null) || (editingId.value !== null && parentId.value !== null))

const dialogTitle = computed(() => {
  if (editingId.value) return t('health.edit')
  return parentId.value === null ? t('health.addLevel1') : t('health.addLevel2')
})

async function fetchList() {
  loading.value = true
  try {
    const r = await fetchIndicatorTree({ keyword: kw.value })
    list.value = r.data || []
  } finally {
    loading.value = false
  }
}

function openCreate(parent: IndicatorNode | null) {
  editingId.value = null
  parentId.value = parent ? parent.id : null
  parentName.value = parent ? parent.name : ''
  form.value = { name: '', code: '', description: '', sort_order: 0, status: 1 }
  dialogVisible.value = true
}

function openEditChild(child: IndicatorNode) {
  editingId.value = child.id
  parentId.value = child.parent_id
  parentName.value = findParentName(child.parent_id)
  form.value = { name: child.name, code: child.code, description: child.description || '', sort_order: child.sort_order, status: child.status }
  dialogVisible.value = true
}

function openEditRow(row: IndicatorNode) {
  editingId.value = row.id
  parentId.value = null
  parentName.value = ''
  form.value = { name: row.name, code: row.code, description: row.description || '', sort_order: row.sort_order, status: row.status }
  dialogVisible.value = true
}

function findParentName(id: number | null): string {
  if (id === null) return ''
  const p = list.value.find((n) => n.id === id)
  return p ? p.name : ''
}

function errText(key?: string): string {
  if (!key) return t('health.operationFailed')
  const msg = t(`health.${key}`)
  return msg.startsWith('health.') ? t('health.operationFailed') : msg
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = { ...form.value, parent_id: parentId.value }
    if (editingId.value) {
      await updateIndicator(editingId.value, payload)
      ElMessage.success(t('health.updateSuccess'))
    } else {
      await createIndicator(payload)
      ElMessage.success(t('health.createSuccess'))
    }
    dialogVisible.value = false
    await fetchList()
  } catch (e: any) {
    ElMessage.error(errText(e?.message))
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(node: IndicatorNode, value: number) {
  const prev = node.status
  node.status = value
  try {
    await updateIndicator(node.id, { status: value })
  } catch (e: any) {
    node.status = prev
    ElMessage.error(errText(e?.message))
  }
}

async function handleDelete(id: number) {
  try {
    await deleteIndicator(id)
    ElMessage.success(t('health.deleteSuccess'))
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
.child-list { padding: 4px 12px; }
.child-empty { color: #94a3b8; font-size: 13px; padding: 6px 4px; }
.child-row { display: flex; align-items: center; gap: 12px; padding: 6px 8px; border-radius: 8px; }
.child-row:hover { background: #f8fafc; }
.child-name { font-weight: 500; min-width: 140px; }
.child-code { color: #64748b; min-width: 110px; }
.child-desc { color: #94a3b8; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops { margin-left: auto; display: flex; align-items: center; }
.lvl-tag { display: inline-block; margin-right: 8px; padding: 1px 8px; border-radius: 10px; font-size: 12px; }
.lvl-tag.l1 { background: #eff6ff; color: #3b82f6; }
.lvl-tag.l2 { background: #f0fdf4; color: #16a34a; }
.row-name { font-weight: 500; }
</style>
