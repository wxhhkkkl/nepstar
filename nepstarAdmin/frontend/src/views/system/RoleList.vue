<template>
  <div class="page">
    <h2 class="page-title">{{ $t('menu.roleMgmt') }}</h2>
    <div class="card">
      <div class="tb">
        <el-input v-model="kw" :placeholder="$t('common.searchPlaceholder')" style="width:240px" clearable @input="fetchList" />
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          {{ $t('role.createRole') }}
        </el-button>
      </div>
      <el-table :data="list" v-loading="loading" stripe :empty-text="$t('common.noData')">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="role_name" :label="$t('role.roleName')" min-width="120" />
        <el-table-column prop="role_code" :label="$t('role.roleCode')" width="110" />
        <el-table-column :label="$t('role.permissions')" width="80" align="center">
          <template #default="{ row }">
            <span class="count-badge">{{ row.menu_count }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('role.dataScope')" width="80" align="center">
          <template #default="{ row }">
            <span class="count-badge org-count">{{ row.org_count }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('role.assignPermissions')" width="80" align="center">
          <template #default="{ row }">
            <span class="count-badge user-count">{{ row.user_count }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.operation')" width="160" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openEdit(row)">
              {{ $t('common.edit') }}
            </el-button>
            <el-popconfirm
              :title="t('role.confirmDelete', { name: row.role_name })"
              :disabled="row.role_code === 'admin'"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button text type="danger" size="small" :disabled="row.role_code === 'admin'">
                  {{ $t('common.delete') }}
                </el-button>
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

    <!-- Create / Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? $t('role.editRole') : $t('role.createRole')"
      width="650px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="$t('role.roleName')" prop="role_name">
          <el-input v-model="form.role_name" maxlength="50" />
        </el-form-item>
        <el-form-item :label="$t('role.roleCode')" prop="role_code">
          <el-input v-model="form.role_code" maxlength="50" :disabled="!!editingId" />
        </el-form-item>

        <!-- Menu permissions -->
        <el-form-item :label="$t('role.permissions')">
          <div class="tree-box">
            <el-tree
              ref="permTreeRef"
              :data="menuTree"
              node-key="id"
              show-checkbox
              default-expand-all
              :expand-on-click-node="false"
              :props="{ children: 'children', label: 'label' }"
            />
          </div>
        </el-form-item>

        <!-- Data permission: org tree -->
        <el-form-item :label="$t('role.dataScope')">
          <div class="tree-box">
            <p class="tree-hint">{{ $t('role.dataScopeOrgsHint') }}</p>
            <el-tree
              ref="orgTreeRef"
              :data="orgTree"
              node-key="id"
              show-checkbox
              check-strictly
              default-expand-all
              :expand-on-click-node="false"
              :props="{ children: 'children', label: 'org_name' }"
              @check="onOrgCheck"
            />
          </div>
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
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules, type TreeInstance } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import api from '@/api/client'

const { t } = useI18n()
const appStore = useAppStore()

interface MenuNode {
  id: number
  name_zh: string
  name_en: string
  name_es: string
  children?: MenuNode[]
  label?: string
}

interface OrgNode {
  id: number
  org_name: string
  org_code: string
  children?: OrgNode[]
}

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const kw = ref('')

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const permTreeRef = ref<TreeInstance>()
const orgTreeRef = ref<TreeInstance>()

const form = ref({
  role_name: '',
  role_code: '',
  data_scope: 'self',
})

const rules: FormRules = {
  role_name: [{ required: true, message: t('role.roleNameRequired'), trigger: 'blur' }],
  role_code: [{ required: true, message: t('role.roleCodeRequired'), trigger: 'blur' }],
}

const rawMenuData = ref<MenuNode[]>([])
const orgTree = ref<OrgNode[]>([])

function addMenuLabels(nodes: MenuNode[]): MenuNode[] {
  return nodes.map(n => ({
    ...n,
    label: appStore.language === 'en' ? n.name_en : appStore.language === 'es' ? n.name_es : n.name_zh,
    children: n.children?.length ? addMenuLabels(n.children) : [],
  }))
}

const menuTree = computed(() => addMenuLabels(rawMenuData.value))

async function fetchList() {
  loading.value = true
  try {
    const r = await api.get('/roles', { params: { page: page.value, page_size: pageSize.value, keyword: kw.value } })
    list.value = r.data.records
    total.value = r.data.total
  } finally { loading.value = false }
}

async function fetchMenuTree() {
  const r = await api.get('/menus')
  rawMenuData.value = r.data
}

async function fetchOrgTree() {
  const r = await api.get('/organizations')
  orgTree.value = r.data
}

function resetTrees() {
  setTimeout(() => {
    permTreeRef.value?.setCheckedKeys([])
    orgTreeRef.value?.setCheckedKeys([])
  }, 0)
}

function getDescendantKeys(node: any): number[] {
  const keys: number[] = []
  if (node.children?.length) {
    for (const child of node.children) {
      keys.push(child.id)
      keys.push(...getDescendantKeys(child))
    }
  }
  return keys
}

function onOrgCheck(data: any) {
  const tree = orgTreeRef.value
  if (!tree) return
  const descendantKeys = getDescendantKeys(data)
  if (descendantKeys.length === 0) return
  const currentChecked = tree.getCheckedKeys() as number[]
  const isChecking = currentChecked.includes(data.id)
  if (isChecking) {
    // parent checked → auto-check all descendants
    tree.setCheckedKeys([...new Set([...currentChecked, ...descendantKeys])])
  } else {
    // parent unchecked → auto-uncheck all descendants
    tree.setCheckedKeys(currentChecked.filter(k => !descendantKeys.includes(k)))
  }
}

function openCreate() {
  editingId.value = null
  form.value = { role_name: '', role_code: '', data_scope: 'self' }
  dialogVisible.value = true
  resetTrees()
}

async function openEdit(row: any) {
  editingId.value = row.id
  form.value = {
    role_name: row.role_name,
    role_code: row.role_code,
    data_scope: row.data_scope || 'self',
  }
  dialogVisible.value = true
  try {
    const r = await api.get(`/roles/${row.id}`)
    setTimeout(() => {
      permTreeRef.value?.setCheckedKeys((r.data.menu_permissions || []).map((p: any) => p.menu_id))
      orgTreeRef.value?.setCheckedKeys(r.data.org_ids || [])
    }, 0)
  } catch {
    resetTrees()
  }
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const menuIds = (permTreeRef.value?.getCheckedKeys() || []) as number[]
    const orgIds = (orgTreeRef.value?.getCheckedKeys() || []) as number[]
    const payload = {
      ...form.value,
      menu_permissions: menuIds.map(menu_id => ({
        menu_id,
        actions: 'view,add,edit,delete,export,import',
      })),
      org_ids: orgIds,
    }
    if (editingId.value) {
      await api.put(`/roles/${editingId.value}`, payload)
      ElMessage.success(t('role.updateSuccess'))
    } else {
      await api.post('/roles', payload)
      ElMessage.success(t('role.createSuccess'))
    }
    dialogVisible.value = false
    await fetchList()
  } catch (e: any) {
    const key = e?.message
    const msg = t(`role.${key}`)
    ElMessage.error(msg.startsWith('role.') ? (key || t('common.operationFailed')) : msg)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await api.delete(`/roles/${id}`)
    ElMessage.success(t('role.deleteSuccess'))
    await fetchList()
  } catch (e: any) {
    const key = e?.message
    const msg = t(`role.${key}`)
    ElMessage.error(msg.startsWith('role.') ? (key || t('common.deleteFailed')) : msg)
  }
}

onMounted(() => {
  fetchList()
  fetchMenuTree()
  fetchOrgTree()
})
</script>

<style scoped>
.page { max-width: 1400px; }
.page-title { font-size: 22px; font-weight: 600; color: #1e293b; margin-bottom: 20px; }
.card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04); }
.tb { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
.count-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 24px; height: 22px; padding: 0 6px;
  border-radius: 11px; background: #e2e8f0; color: #64748b;
  font-size: 12px; font-weight: 500;
}
.count-badge.user-count { background: #eff6ff; color: #3b82f6; }
.count-badge.org-count { background: #f0fdf4; color: #16a34a; }

.tree-box {
  max-height: 30vh; min-height: 120px; overflow-y: auto;
  border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px;
  width: 100%; box-sizing: border-box;
}
.tree-hint {
  color: #94a3b8; font-size: 12px; margin: 0 0 6px 4px;
}
:deep(.tree-box .el-tree) { background: transparent; }
:deep(.tree-box .el-tree-node__content) {
  height: auto; padding: 4px 6px; border-radius: 6px;
}
:deep(.tree-box .el-tree-node__content:hover) { background: #f8fafc; }
</style>
