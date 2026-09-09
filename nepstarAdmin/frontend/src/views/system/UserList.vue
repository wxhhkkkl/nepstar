<template>
  <div class="page">
    <h2 class="page-title">{{ $t('menu.userMgmt') }}</h2>
    <div class="card">
      <div class="tb">
        <el-input v-model="kw" :placeholder="$t('common.searchPlaceholder')" style="width:240px" clearable @input="fetchList" />
        <el-button type="primary" @click="openCreate">{{ $t('user.createUser') }}</el-button>
      </div>
      <el-table :data="list" v-loading="loading" stripe :empty-text="$t('common.noData')">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" :label="$t('user.username')" />
        <el-table-column prop="real_name" :label="$t('user.realName')" />
        <el-table-column prop="status" :label="$t('common.status')" width="100">
          <template #default="{row}">
            <el-tag :type="row.status===1?'success':'danger'" size="small">{{ row.status===1?$t('common.enabled'):$t('common.disabled') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.operation')" width="180">
          <template #default="{row}">
            <el-button text type="primary" size="small" @click="openEdit(row)">{{ $t('common.edit') }}</el-button>
            <el-popconfirm
              :title="$t('user.confirmDelete', { name: row.username })"
              :disabled="row.username === 'admin'"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button text type="danger" size="small" :disabled="row.username === 'admin'">
                  {{ $t('common.delete') }}
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination :total="total" v-model:current-page="page" :page-size="pageSize" layout="prev,pager,next" @change="fetchList" background />
      </div>
    </div>
    <!-- Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="editingId ? $t('user.editUser') : $t('user.createUser')" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item :label="$t('user.username')">
          <el-input v-model="form.username" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item :label="$t('user.realName')">
          <el-input v-model="form.real_name" />
        </el-form-item>
        <el-form-item :label="$t('user.password')">
          <el-input v-model="form.password" type="password" :placeholder="editingId ? $t('user.leaveEmpty') : $t('user.enterPassword')" show-password minlength="8" />
          <span v-if="!editingId" style="color:#94a3b8;font-size:12px;">至少8个字符，留空则使用默认密码</span>
        </el-form-item>
        <el-form-item :label="$t('user.roles')">
          <el-select v-model="form.role_id" :placeholder="$t('role.selectRole')" style="width:100%">
            <el-option v-for="r in roleList" :key="r.id" :label="r.role_name" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import api from '@/api/client';

const { t } = useI18n();

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const kw = ref('');
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const form = ref({ username: '', real_name: '', password: '', role_id: null as number | null });
const roleList = ref<any[]>([]);

async function fetchList() {
  loading.value = true;
  try {
    const r = await api.get('/users', { params: { page: page.value, page_size: pageSize.value, keyword: kw.value } });
    list.value = r.data.records;
    total.value = r.data.total;
  } finally { loading.value = false; }
}

function openCreate() {
  editingId.value = null;
  form.value = { username: '', real_name: '', password: '', role_id: null };
  dialogVisible.value = true;
}

async function openEdit(row: any) {
  editingId.value = row.id;
  form.value = { username: row.username, real_name: row.real_name, password: '', role_id: null };
  dialogVisible.value = true;
  try {
    const r = await api.get(`/users/${row.id}`);
    form.value.role_id = r.data.role_ids?.[0] ?? null;
  } catch { /* ignore */ }
}

async function fetchRoles() {
  try {
    const r = await api.get('/roles', { params: { page_size: 100 } });
    roleList.value = r.data.records || [];
  } catch { /* ignore */ }
}

async function handleSave() {
  saving.value = true;
  try {
    const payload: any = {
      real_name: form.value.real_name,
      role_ids: form.value.role_id ? [form.value.role_id] : [],
    };
    if (form.value.password) payload.password = form.value.password;
    if (editingId.value) {
      await api.put(`/users/${editingId.value}`, payload);
      ElMessage.success(t('common.saveSuccess'));
    } else {
      const pwd = form.value.password || 'Temp12345';
      if (pwd.length < 8) {
        ElMessage.error('密码至少需要8个字符');
        saving.value = false;
        return;
      }
      await api.post('/users', {
        username: form.value.username,
        real_name: form.value.real_name,
        password: pwd,
        org_ids: [1],
        role_ids: form.value.role_id ? [form.value.role_id] : [],
      });
      ElMessage.success(t('common.createSuccess'));
    }
    dialogVisible.value = false;
    fetchList();
  } catch (e: any) {
    const detail = e?.detail;
    if (Array.isArray(detail)) {
      const msgs = detail.map((d: any) => d.msg).join('; ');
      ElMessage.error(msgs);
    } else {
      ElMessage.error(e?.message || t('common.operationFailed'));
    }
  } finally { saving.value = false; }
}

async function handleDelete(id: number) {
  try {
    await api.delete(`/users/${id}`);
    ElMessage.success(t('common.deleteSuccess'));
    fetchList();
  } catch (e: any) {
    ElMessage.error(e.message || t('common.deleteFailed'));
  }
}

onMounted(() => {
  fetchList();
  fetchRoles();
});
</script>

<style scoped>
.page { max-width: 1400px; }
.page-title { font-size: 22px; font-weight: 600; color: #1e293b; margin-bottom: 20px; }
.card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04); }
.tb { display: flex; justify-content: space-between; margin-bottom: 16px; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
