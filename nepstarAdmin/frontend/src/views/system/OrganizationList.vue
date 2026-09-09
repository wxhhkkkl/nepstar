<template>
  <div class="page">
    <h2 class="page-title">{{ $t('menu.orgMgmt') }}</h2>

    <div class="card">
      <div class="toolbar">
        <el-input
          v-model="filterText"
          :placeholder="$t('common.searchPlaceholder')"
          prefix-icon="Search"
          clearable
          style="width:260px"
        />
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          {{ $t('org.createOrg') }}
        </el-button>
      </div>

      <el-tree
        ref="treeRef"
        :data="tree"
        node-key="id"
        default-expand-all
        :filter-node-method="filterNode"
        :props="{ children: 'children', label: 'org_name' }"
        :expand-on-click-node="false"
        :empty-text="$t('common.noData')"
        highlight-current
      >
        <template #default="{ node, data }">
          <div
            class="tree-node"
            :class="{ 'is-leaf': !data.children?.length, 'is-root': data.parent_id === null }"
          >
            <el-icon class="node-icon" :size="18">
              <OfficeBuilding v-if="data.parent_id === null" />
              <FolderOpened v-else-if="data.children?.length" />
              <Folder v-else />
            </el-icon>

            <div class="node-body">
              <div class="node-main">
                <span class="node-name">{{ data.org_name }}</span>
                <el-tag size="small" effect="plain">{{ data.org_code }}</el-tag>
                <span v-if="data.children?.length" class="child-count">
                  {{ data.children.length }}
                </span>
              </div>
            </div>

            <div class="node-actions">
              <el-button text size="small" type="primary" @click.stop="openEdit(data)">
                <el-icon><Edit /></el-icon>
                <span class="action-text">{{ $t('common.edit') }}</span>
              </el-button>
              <el-button
                text size="small" type="danger"
                @click.stop="confirmDelete(data)"
                :disabled="data.org_code === 'LOONGQI' && data.parent_id === null"
              >
                <el-icon><Delete /></el-icon>
                <span class="action-text">{{ $t('common.delete') }}</span>
              </el-button>
            </div>
          </div>
        </template>
      </el-tree>
    </div>

    <!-- Create / Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? $t('org.editOrg') : $t('org.createOrg')"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="$t('org.orgName')" prop="org_name">
          <el-input v-model="form.org_name" maxlength="100" />
        </el-form-item>
        <el-form-item :label="$t('org.orgCode')" prop="org_code">
          <el-input v-model="form.org_code" maxlength="50" :disabled="isEdit" />
        </el-form-item>
        <el-form-item :label="$t('org.parentOrg')">
          <el-tree-select
            v-model="form.parent_id"
            :data="treeSelectData"
            :props="{ children: 'children', label: 'org_name', value: 'id' }"
            default-expand-all
            :render-after-expand="false"
            check-strictly
            clearable
            filterable
            :placeholder="$t('org.parentOrg')"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item :label="$t('org.sortOrder')">
          <el-input-number v-model="form.sort_order" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- Delete Confirm -->
    <el-dialog v-model="deleteVisible" :title="$t('common.confirm')" width="400px">
      <p>{{ t('org.confirmDelete', { name: deleteTarget?.org_name }) }}</p>
      <p v-if="deleteTarget?.children?.length" style="color:#f56c6c">{{ $t('org.hasChildrenHint') }}</p>
      <template #footer>
        <el-button @click="deleteVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="danger" @click="doDelete" :loading="submitting" :disabled="deleteTarget?.children?.length">{{ $t('common.delete') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules, type TreeInstance } from 'element-plus'
import { Plus, Edit, Delete, OfficeBuilding, FolderOpened, Folder } from '@element-plus/icons-vue'
import api from '@/api/client'

const { t } = useI18n()

interface OrgNode {
  id: number
  org_name: string
  org_code: string
  parent_id: number | null
  sort_order: number
  children?: OrgNode[]
}

const tree = ref<OrgNode[]>([])
const treeSelectData = ref<OrgNode[]>([])
const treeRef = ref<TreeInstance>()
const dialogVisible = ref(false)
const deleteVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const deleteTarget = ref<OrgNode | null>(null)
const editingId = ref<number | null>(null)
const filterText = ref('')

const form = ref({
  org_name: '',
  org_code: '',
  parent_id: null as number | null,
  sort_order: 0,
})

const rules: FormRules = {
  org_name: [{ required: true, message: t('org.orgNameRequired'), trigger: 'blur' }],
  org_code: [{ required: true, message: t('org.orgCodeRequired'), trigger: 'blur' }],
}

watch(filterText, (val) => {
  treeRef.value?.filter(val)
})

function filterNode(value: string, data: OrgNode): boolean {
  if (!value) return true
  const v = value.toLowerCase()
  return data.org_name.toLowerCase().includes(v) || data.org_code.toLowerCase().includes(v)
}

async function fetchTree() {
  const r = await api.get('/organizations')
  tree.value = r.data
  treeSelectData.value = r.data
}

function openCreate() {
  isEdit.value = false
  editingId.value = null
  form.value = { org_name: '', org_code: '', parent_id: null, sort_order: 0 }
  dialogVisible.value = true
}

function openEdit(data: OrgNode) {
  isEdit.value = true
  editingId.value = data.id
  form.value = {
    org_name: data.org_name,
    org_code: data.org_code,
    parent_id: data.parent_id,
    sort_order: data.sort_order,
  }
  dialogVisible.value = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (isEdit.value) {
      await api.put(`/organizations/${editingId.value}`, {
        org_name: form.value.org_name,
        parent_id: form.value.parent_id,
        sort_order: form.value.sort_order,
      })
      ElMessage.success(t('org.updateSuccess'))
    } else {
      await api.post('/organizations', form.value)
      ElMessage.success(t('org.createSuccess'))
    }
    dialogVisible.value = false
    await fetchTree()
  } catch (e: any) {
    const key = e?.message
    const msg = t(`org.${key}`)
    ElMessage.error(msg.startsWith('org.') ? (key || t('common.operationFailed')) : msg)
  } finally {
    submitting.value = false
  }
}

function confirmDelete(data: OrgNode) {
  deleteTarget.value = data
  deleteVisible.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  submitting.value = true
  try {
    await api.delete(`/organizations/${deleteTarget.value.id}`)
    ElMessage.success(t('org.deleteSuccess'))
    deleteVisible.value = false
    deleteTarget.value = null
    await fetchTree()
  } catch (e: any) {
    const key = e?.message
    const msg = t(`org.${key}`)
    ElMessage.error(msg.startsWith('org.') ? (key || t('common.deleteFailed')) : msg)
  } finally {
    submitting.value = false
  }
}

onMounted(fetchTree)
</script>

<style scoped>
.page { max-width: 1400px; }
.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 20px;
}

/* ── Card ── */
.card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
}

/* ── Toolbar ── */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}

/* ── Tree container ── */
:deep(.el-tree) {
  background: transparent;
}

/* ── Tree node row ── */
:deep(.el-tree-node__content) {
  height: auto;
  padding: 6px 8px;
  margin: 2px 0;
  border-radius: 8px;
  transition: background .18s ease;
}
:deep(.el-tree-node__content:hover) {
  background: #f8fafc;
}
:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #eff6ff;
}

/* ── Expand icon ── */
:deep(.el-tree-node__expand-icon) {
  color: #94a3b8;
  transition: transform .2s ease, color .18s;
}
:deep(.el-tree-node__expand-icon:hover) {
  color: #3b82f6;
}
:deep(.el-tree-node__expand-icon.is-leaf) {
  color: transparent;
  cursor: default;
}

/* ── Indent guide lines ── */
:deep(.el-tree-node) {
  position: relative;
}
:deep(.el-tree-node > .el-tree-node__children) {
  position: relative;
}
:deep(.el-tree-node > .el-tree-node__children::before) {
  content: '';
  position: absolute;
  left: 11px;
  top: 0;
  bottom: 18px;
  width: 1px;
  background: linear-gradient(to bottom, #e2e8f0 60%, transparent);
}

/* ── Node card ── */
.tree-node {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  flex: 1;
  min-width: 0;
}

/* ── Node icon ── */
.node-icon {
  flex-shrink: 0;
  color: #94a3b8;
  transition: color .18s;
}
.tree-node.is-root .node-icon {
  color: #3b82f6;
}
.tree-node:not(.is-leaf) .node-icon {
  color: #6366f1;
}

/* ── Node body ── */
.node-body {
  flex: 1;
  min-width: 0;
}
.node-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.node-name {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
}
.tree-node.is-root .node-name {
  font-weight: 600;
  color: #0f172a;
}

/* ── Child-count badge ── */
.child-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #e2e8f0;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

/* ── Actions ── */
.node-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity .18s;
}
:deep(.el-tree-node__content:hover) .node-actions {
  opacity: 1;
}
.node-actions .action-text {
  margin-left: 2px;
}
.node-actions .el-button {
  border-radius: 6px;
  padding: 4px 8px;
}

/* ── Responsive: hide action labels on small screens ── */
@media (max-width: 768px) {
  .node-actions .action-text {
    display: none;
  }
}
</style>
