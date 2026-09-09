<template>
  <div class="report-page">
    <!-- 左侧组织树 -->
    <el-aside width="240px" class="left-panel">
      <OrgTreePanel
        :org-tree="orgTree"
        @node-click="onOrgNodeClick"
      />
    </el-aside>

    <!-- 右侧主内容 -->
    <el-main class="main-content">
      <h2 class="page-title">{{ $t('report.reportPageTitle') || '检测报告' }}</h2>

      <!-- 筛选工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <span v-if="selectedOrgName" class="org-badge">
            {{ selectedOrgName }}
            <el-icon class="badge-close" @click="clearOrgFilter"><CloseBold /></el-icon>
          </span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            :start-placeholder="$t('report.startDate') || '开始日期'"
            :end-placeholder="$t('report.endDate') || '结束日期'"
            value-format="YYYY-MM-DD"
            size="small"
            style="width: 260px"
          />
          <el-input
            v-model="snFilter"
            :placeholder="$t('report.snPlaceholder') || '输入设备SN搜索'"
            size="small"
            clearable
            style="width: 200px"
            @change="onFilterChange"
          />
          <el-button type="primary" size="small" @click="onFilterChange">
            {{ $t('common.search') || '查询' }}
          </el-button>
        </div>
        <div class="toolbar-right">
          <el-button @click="resetFilters" size="small">{{ $t('common.reset') || '重置' }}</el-button>
        </div>
      </div>

      <!-- 数据库错误提示 -->
      <el-alert
        v-if="dbError"
        :title="$t('report.reportUnavailable') || '检测报告数据暂不可用'"
        type="warning"
        show-icon
        closable
        @close="dbError = false"
        class="error-alert"
      >
        <template #default>
          <el-button type="primary" size="small" @click="fetchList">
            {{ $t('common.retry') || '重试' }}
          </el-button>
        </template>
      </el-alert>

      <!-- 报告表格 -->
      <div class="card">
        <el-table :data="list" v-loading="loading" stripe empty-text="">
          <el-table-column prop="report_id" :label="$t('report.reportId') || '报告ID'" width="100" />
          <el-table-column prop="device_sn" :label="$t('report.deviceSn') || '设备SN'" width="140" />
          <el-table-column prop="device_name" :label="$t('report.deviceName') || '设备名称'" min-width="140" />
          <el-table-column prop="inspect_date" :label="$t('report.detectTime') || '检测时间'" width="170">
            <template #default="{ row }">
              {{ row.inspect_date ? new Date(row.inspect_date).toLocaleString() : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="total_score" :label="$t('report.totalScore') || '综合得分'" width="100" />
          <el-table-column prop="status_text" :label="$t('report.reportStatus') || '状态'" width="80" />
          <el-table-column prop="mobile" :label="$t('report.mobile') || '手机号'" width="130" />
          <el-table-column prop="name" :label="$t('report.name') || '姓名'" width="100" />
          <el-table-column :label="$t('common.operation') || '操作'" width="80" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.report_url"
                type="primary"
                size="small"
                link
                @click="openReportUrl(row.report_url)"
              >
                {{ $t('report.view') || '查看' }}
              </el-button>
              <el-button
                v-else
                type="info"
                size="small"
                link
                disabled
                @click="handleUrlUnavailable"
              >
                {{ $t('report.view') || '查看' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && list.length === 0 && !dbError" class="empty-state">
          <el-empty :description="$t('report.noReports') || '暂无检测报告数据'" />
        </div>

        <!-- 分页 -->
        <div v-if="total > 0" class="pager">
          <el-pagination
            v-model:current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="prev, pager, next"
            background
            @current-change="fetchList"
          />
        </div>
      </div>
    </el-main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { CloseBold } from '@element-plus/icons-vue';
import { getReports } from '@/api/reports';
import { getOrganizationsTree, type OrgTreeNode } from '@/api/devices';
import OrgTreePanel from '@/components/OrgTreePanel.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// ---- 状态 ----
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const dbError = ref(false);

const orgTree = ref<OrgTreeNode[]>([]);
const selectedOrgId = ref<number | null>(null);
const selectedOrgName = ref('');
const dateRange = ref<string[] | null>(null);
const snFilter = ref('');

// ---- 数据加载 ----
async function fetchOrgTree() {
  try {
    orgTree.value = await getOrganizationsTree();
  } catch {
    orgTree.value = [];
  }
}

async function fetchList() {
  loading.value = true;
  dbError.value = false;
  try {
    const r = await getReports({
      page: page.value,
      page_size: pageSize.value,
      org_id: selectedOrgId.value ?? undefined,
      start_date: dateRange.value?.[0] ?? undefined,
      end_date: dateRange.value?.[1] ?? undefined,
      sn: snFilter.value || undefined,
    });
    list.value = r.data.records ?? [];
    total.value = r.data.total ?? 0;
  } catch {
    dbError.value = true;
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

// ---- 组织树交互 ----
function onOrgNodeClick(node: OrgTreeNode) {
  selectedOrgId.value = node.id;
  selectedOrgName.value = node.org_name;
  page.value = 1;
  fetchList();
}

function clearOrgFilter() {
  selectedOrgId.value = null;
  selectedOrgName.value = '';
  page.value = 1;
  fetchList();
}

// ---- 筛选变化 ----
function onFilterChange() {
  page.value = 1;
  fetchList();
}

// ---- 筛选重置 ----
function resetFilters() {
  selectedOrgId.value = null;
  selectedOrgName.value = '';
  dateRange.value = null;
  snFilter.value = '';
  page.value = 1;
  fetchList();
}

// ---- 报告查看 ----
function openReportUrl(url: string) {
  window.open(url, '_blank');
}

function handleUrlUnavailable() {
  ElMessage.warning(t('report.urlUnavailable') || '报告地址不可用');
}

// ---- 初始化 ----
onMounted(() => {
  fetchOrgTree();
  fetchList();
});
</script>

<style scoped>
.report-page {
  display: flex;
  height: calc(100vh - 60px);
}

.left-panel {
  flex-shrink: 0;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.org-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #d6f0f1;
  color: #026066;
  border-radius: 6px;
  font-size: 13px;
}

.badge-close {
  cursor: pointer;
  font-size: 12px;
}

.error-alert {
  margin-bottom: 16px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}

.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
