<template>
  <div class="customer-page">
    <!-- 左侧组织树 -->
    <el-aside width="240px" class="left-panel">
      <OrgTreePanel
        :org-tree="orgTree"
        @node-click="onOrgNodeClick"
      />
    </el-aside>

    <!-- 右侧主内容 -->
    <el-main class="main-content">
      <h2 class="page-title">{{ $t('customer.customerPageTitle') || '客户管理' }}</h2>

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
            :start-placeholder="$t('customer.startDate') || '开始日期'"
            :end-placeholder="$t('customer.endDate') || '结束日期'"
            value-format="YYYY-MM-DD"
            size="small"
            style="width: 260px"
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
        :title="$t('customer.customerUnavailable') || '客户数据暂不可用'"
        type="warning"
        show-icon
        closable
        @close="dbError = false"
        class="error-alert"
      >
        <template #default>
          <el-button type="primary" size="small" @click="fetchList">重试</el-button>
        </template>
      </el-alert>

      <!-- 客户表格 -->
      <div class="card">
        <el-table :data="list" v-loading="loading" stripe>
          <el-table-column prop="customer_id" :label="$t('customer.customerId') || '客户ID'" width="110" />
          <el-table-column prop="name" :label="$t('customer.customerName') || '客户姓名'" min-width="100" />
          <el-table-column prop="mobile" :label="$t('customer.mobile') || '手机号'" min-width="130" />
          <el-table-column prop="age" :label="$t('customer.age') || '年龄'" width="70" />
          <el-table-column prop="sex_text" :label="$t('customer.sex') || '性别'" width="60" />
          <el-table-column prop="height" :label="$t('customer.height') || '身高'" width="70" />
          <el-table-column prop="weight" :label="$t('customer.weight') || '体重'" width="70" />
          <el-table-column prop="latest_inspect_date" :label="$t('customer.latestInspectDate') || '最近检测时间'" min-width="170">
            <template #default="{ row }">
              {{ row.latest_inspect_date ? new Date(row.latest_inspect_date).toLocaleString() : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="report_count" :label="$t('customer.reportCount') || '报告数'" width="80" />
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && list.length === 0 && !dbError" class="empty-state">
          <el-empty :description="$t('customer.noCustomers') || '暂无客户数据'" />
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
import { CloseBold } from '@element-plus/icons-vue';
import { getCustomers } from '@/api/customers';
import { getOrganizationsTree, type OrgTreeNode } from '@/api/devices';
import OrgTreePanel from '@/components/OrgTreePanel.vue';

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
    const r = await getCustomers({
      page: page.value,
      page_size: pageSize.value,
      org_id: selectedOrgId.value ?? undefined,
      start_date: dateRange.value?.[0] ?? undefined,
      end_date: dateRange.value?.[1] ?? undefined,
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

// ---- 组织树 ----
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

function onFilterChange() {
  page.value = 1;
  fetchList();
}

function resetFilters() {
  selectedOrgId.value = null;
  selectedOrgName.value = '';
  dateRange.value = null;
  page.value = 1;
  fetchList();
}

// ---- 初始化 ----
onMounted(() => {
  fetchOrgTree();
  fetchList();
});
</script>

<style scoped>
.customer-page {
  display: flex;
  height: calc(100vh - 60px);
}
.left-panel { flex-shrink: 0; overflow: hidden; }
.main-content { flex: 1; overflow: auto; padding: 20px 24px; }
.page-title { font-size: 22px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.org-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #e0e7ff; color: #4338ca; border-radius: 6px; font-size: 13px; }
.badge-close { cursor: pointer; font-size: 12px; }
.error-alert { margin-bottom: 16px; }
.card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04); }
.empty-state { padding: 40px 0; text-align: center; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
