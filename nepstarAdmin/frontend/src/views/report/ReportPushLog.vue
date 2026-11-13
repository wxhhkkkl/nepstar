<template>
  <div class="push-log-page">
    <h2 class="page-title">{{ t('report.pushLogTitle') }}</h2>

    <div class="card toolbar">
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        :start-placeholder="t('report.startDate')"
        :end-placeholder="t('report.endDate')"
        value-format="YYYY-MM-DD"
        size="small"
        style="width: 260px"
      />
      <el-select
        v-model="statusFilter"
        clearable
        size="small"
        :placeholder="t('report.pushStatus')"
        style="width: 140px"
      >
        <el-option :label="t('report.pushStatusSuccess')" value="success" />
        <el-option :label="t('report.pushStatusFailed')" value="failed" />
        <el-option :label="t('report.pushStatusPending')" value="pending" />
        <el-option :label="t('report.pushStatusSkipped')" value="skipped" />
      </el-select>
      <el-select
        v-model="triggerFilter"
        clearable
        size="small"
        :placeholder="t('report.pushTrigger')"
        style="width: 130px"
      >
        <el-option :label="t('report.pushTriggerManual')" value="manual" />
        <el-option :label="t('report.pushTriggerAuto')" value="auto" />
      </el-select>
      <el-input
        v-model="snFilter"
        size="small"
        clearable
        :placeholder="t('report.snPlaceholder')"
        style="width: 200px"
        @keyup.enter="onSearch"
      />
      <el-button type="primary" size="small" @click="onSearch">
        {{ t('common.search') }}
      </el-button>
      <el-button size="small" @click="resetFilters">{{ t('common.reset') }}</el-button>
    </div>

    <el-alert
      v-if="loadError"
      :title="t('report.pushLoadFailed')"
      type="warning"
      show-icon
      closable
      class="error-alert"
      @close="loadError = false"
    >
      <template #default>
        <el-button type="primary" size="small" @click="fetchList">
          {{ t('common.retry') || '重试' }}
        </el-button>
      </template>
    </el-alert>

    <div class="card">
      <el-table :data="list" v-loading="loading" stripe empty-text="">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-panel">
              <p><strong>{{ t('report.pushResponse') }}:</strong> {{ row.response_summary || '-' }}</p>
              <p><strong>{{ t('report.pushRawReason') }}:</strong> {{ row.failure_reason || '-' }}</p>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="report_code" :label="t('report.reportNo')" min-width="210" />
        <el-table-column prop="device_sn" :label="t('report.deviceSn')" width="150" />
        <el-table-column :label="t('report.pushTrigger')" width="100">
          <template #default="{ row }">{{ triggerText(row.trigger_type) }}</template>
        </el-table-column>
        <el-table-column :label="t('report.pushStatus')" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('report.pushReason')" min-width="220">
          <template #default="{ row }">
            <span v-if="row.failure_reason" :title="row.failure_reason">
              {{ reasonText(row.failure_reason) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('report.pushTime')" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column :label="t('report.pushFinishedTime')" width="170">
          <template #default="{ row }">{{ formatTime(row.finished_at) }}</template>
        </el-table-column>
        <el-table-column :label="t('common.operation')" width="90" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              link
              :loading="repushingId === row.id"
              @click="handleRepush(row)"
            >
              {{ t('report.pushRepush') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && list.length === 0 && !loadError"
        :description="t('report.pushNoRecords')"
      />

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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import {
  getPushRecords,
  repushRecord,
  PUSH_REASON_KEYS,
  type PushRecord,
  type PushStatus,
  type PushTrigger,
} from '@/api/reports';

const { t } = useI18n();

const list = ref<PushRecord[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const loadError = ref(false);

const dateRange = ref<string[] | null>(null);
const statusFilter = ref<PushStatus | ''>('');
const triggerFilter = ref<PushTrigger | ''>('');
const snFilter = ref('');
const repushingId = ref<number | null>(null);

type TagType = 'success' | 'danger' | 'warning' | 'info';

const STATUS_TAG: Record<PushStatus, TagType> = {
  success: 'success',
  failed: 'danger',
  pending: 'warning',
  skipped: 'info',
};

const STATUS_KEY: Record<PushStatus, string> = {
  success: 'pushStatusSuccess',
  failed: 'pushStatusFailed',
  pending: 'pushStatusPending',
  skipped: 'pushStatusSkipped',
};

function statusTag(status: PushStatus): TagType {
  return STATUS_TAG[status] || 'info';
}

function statusText(status: PushStatus) {
  return t(`report.${STATUS_KEY[status] || 'pushStatusPending'}`);
}

function triggerText(trigger: PushTrigger) {
  return trigger === 'manual' ? t('report.pushTriggerManual') : t('report.pushTriggerAuto');
}

function reasonText(reason?: string | null) {
  if (!reason) return '-';
  return t(`report.${PUSH_REASON_KEYS[reason] || 'pushReasonUnknown'}`);
}

function formatTime(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value.endsWith('Z') ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

async function fetchList() {
  loading.value = true;
  loadError.value = false;
  try {
    const r = await getPushRecords({
      page: page.value,
      page_size: pageSize.value,
      start_date: dateRange.value?.[0] ?? undefined,
      end_date: dateRange.value?.[1] ?? undefined,
      status: statusFilter.value || undefined,
      trigger_type: triggerFilter.value || undefined,
      sn: snFilter.value || undefined,
    });
    list.value = r.data.records ?? [];
    total.value = r.data.total ?? 0;
  } catch {
    loadError.value = true;
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  fetchList();
}

function resetFilters() {
  dateRange.value = null;
  statusFilter.value = '';
  triggerFilter.value = '';
  snFilter.value = '';
  page.value = 1;
  fetchList();
}

async function handleRepush(row: PushRecord) {
  if (repushingId.value !== null) return;
  repushingId.value = row.id;
  try {
    const r = await repushRecord(row.id);
    if (r.data?.status === 'success') {
      ElMessage.success(t('report.pushSuccess'));
    } else {
      ElMessage.error(reasonText(r.data?.failure_reason) || t('report.pushFailed'));
    }
    fetchList();
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.operationFailed'));
  } finally {
    repushingId.value = null;
  }
}

onMounted(fetchList);
</script>

<style scoped>
.push-log-page {
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
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
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

.expand-panel {
  padding: 8px 16px;
  color: #475569;
}

.expand-panel p {
  margin: 4px 0;
  word-break: break-all;
}

.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
