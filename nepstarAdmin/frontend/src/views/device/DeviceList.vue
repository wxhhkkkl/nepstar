<template>
  <div class="device-page">
    <!-- 左侧组织树面板 240px -->
    <el-aside class="org-aside" width="240px">
      <OrgTreePanel
        :org-tree="orgTree"
        :title="$t('device.orgTreeTitle') || '组织结构'"
        :empty-text="$t('device.noOrgs') || '暂无可用组织'"
        @node-click="onOrgNodeClick"
      />
    </el-aside>

    <!-- 右侧设备表格 -->
    <el-main class="device-main">
      <h2 class="page-title">{{ $t('menu.deviceList') }}</h2>

      <!-- 工具栏：搜索 -->
      <div class="toolbar">
        <el-input
          v-model="keyword"
          :placeholder="$t('common.search')"
          style="width: 280px"
          clearable
          @change="fetchList"
        />
        <span class="selected-org" v-if="selectedOrgName">
          {{ $t('device.currentOrg') || '当前组织' }}: {{ selectedOrgName }}
        </span>
      </div>

      <!-- 设备表格 -->
      <div class="card">
        <!-- ne 表不可用时的错误状态 -->
        <el-alert
          v-if="dbError"
          type="warning"
          :title="$t('device.dbUnavailable') || '设备数据暂不可用'"
          show-icon
          :closable="false"
        >
          <template #default>
            <el-button text type="primary" @click="fetchList">
              {{ $t('common.retry') || '重试' }}
            </el-button>
          </template>
        </el-alert>

        <el-table v-else :data="list" v-loading="loading" stripe>
          <el-table-column prop="ne_id" label="ID" width="100" />
          <el-table-column prop="ne_no" :label="$t('device.serialNo')" width="150" />
          <el-table-column prop="device_name" :label="$t('device.deviceName')" min-width="140" />
          <el-table-column :label="$t('device.orgName') || '所属组织'" width="120">
            <template #default="{ row }">
              {{ row._org_name || 'LOONGQI' }}
            </template>
          </el-table-column>
          <el-table-column :label="$t('device.reportLanguage') || '报告语言'" width="110">
            <template #default="{ row }">
              {{ row._report_language || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="create_date" :label="$t('device.createDate') || '创建日期'" width="170" />
          <el-table-column :label="$t('common.operation')" width="100" fixed="right">
            <template #default="{ row }">
              <el-button text type="primary" size="small" @click="openEdit(row)">
                {{ $t('common.edit') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态：无设备 -->
        <div v-if="!loading && !dbError && list.length === 0" class="empty-state">
          {{ $t('device.noDevices') || '未找到设备' }}
        </div>

        <!-- 分页 -->
        <div class="pager" v-if="total > 0">
          <el-pagination
            :total="total"
            v-model:current-page="page"
            :page-size="pageSize"
            layout="prev, pager, next"
            @current-change="fetchList"
            background
          />
        </div>
      </div>
    </el-main>

    <!-- 编辑弹窗 -->
    <DeviceEditDialog
      v-if="editVisible"
      v-model:visible="editVisible"
      :device="editingDevice"
      :org-tree="orgTree"
      @saved="onDeviceSaved"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getOrganizationsTree, getDevices } from '@/api/devices';
import OrgTreePanel from '@/components/OrgTreePanel.vue';
import DeviceEditDialog from './DeviceEditDialog.vue';
import type { OrgTreeNode } from '@/api/devices';

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const keyword = ref('');
const dbError = ref(false);

// 组织树
const orgTree = ref<OrgTreeNode[]>([]);
const selectedOrgId = ref<number | null>(null);
const selectedOrgName = ref('');

// 弹窗控制
const editVisible = ref(false);
const editingDevice = ref<any>(null);

async function fetchList() {
  loading.value = true;
  dbError.value = false;
  try {
    const r = await getDevices({
      page: page.value,
      page_size: pageSize.value,
      keyword: keyword.value || undefined,
      org_id: selectedOrgId.value,
    });
    list.value = r.data?.records || [];
    total.value = r.data?.total || 0;
  } catch {
    dbError.value = true;
    list.value = [];
  } finally {
    loading.value = false;
  }
}

async function fetchOrgTree() {
  try {
    orgTree.value = await getOrganizationsTree();
  } catch {
    orgTree.value = [];
  }
}

function onOrgNodeClick(node: OrgTreeNode) {
  selectedOrgId.value = node.id;
  selectedOrgName.value = node.org_name;
  page.value = 1;
  fetchList();
}

function openEdit(device: any) {
  editingDevice.value = { ...device };
  editVisible.value = true;
}

function onDeviceSaved() {
  editVisible.value = false;
  fetchList();
}

onMounted(() => {
  fetchOrgTree();
  fetchList();
});
</script>

<style scoped>
.device-page {
  display: flex;
  height: calc(100vh - 60px);
}

.org-aside {
  flex-shrink: 0;
  overflow: hidden;
}

.device-main {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 20px;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.selected-org {
  font-size: 13px;
  color: #409eff;
  padding: 4px 12px;
  background: #ecf5ff;
  border-radius: 4px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.empty-state {
  padding: 48px;
  text-align: center;
  color: #c0c4cc;
  font-size: 14px;
}
</style>
