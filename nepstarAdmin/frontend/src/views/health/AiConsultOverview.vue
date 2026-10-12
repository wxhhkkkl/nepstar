<template>
  <div class="overview">
    <header class="page-heading">
      <div>
        <p class="eyebrow">AI SERVICE / OPERATIONS</p>
        <h2>AI 咨询运行概览</h2>
        <p class="muted">掌握用量变化，查看每份报告的咨询记录。</p>
      </div>
      <div class="heading-actions">
        <span class="zone">北京时间 UTC+8</span
        ><el-button
          :loading="dashboardLoading || sessionsLoading"
          @click="refresh"
          >刷新数据</el-button
        >
      </div>
    </header>
    <el-alert
      v-if="!canView"
      title="暂无运行概览查看权限"
      type="warning"
      :closable="false"
    />
    <template v-else>
      <el-alert
        v-if="dashboardError"
        :title="dashboardError"
        type="error"
        :closable="false"
        show-icon
      />
      <div v-if="dashboardLoading && !dashboard" class="card">
        <el-skeleton :rows="7" animated />
      </div>
      <template v-else-if="dashboard">
        <section class="metric-grid" aria-label="咨询与 token 汇总">
          <div class="metric">
            <span>新会话</span
            ><strong>{{ number(dashboard.day_sessions) }}</strong
            ><small>{{ dashboard.day }} 建立</small>
          </div>
          <div class="metric">
            <span>回答成功率</span
            ><strong>{{
              dashboard.completion_rate_percent === null
                ? "—"
                : `${dashboard.completion_rate_percent}%`
            }}</strong
            ><small
              >成功 {{ number(dashboard.day_completed) }} · 失败
              {{ number(dashboard.day_failed) }}</small
            >
          </div>
          <div class="metric accent">
            <span>当日 token 消耗</span
            ><strong>{{ number(dashboard.day_usage.actual_tokens) }}</strong
            ><small
              >输入 {{ number(dashboard.day_usage.input_tokens) }} / 输出
              {{ number(dashboard.day_usage.output_tokens) }}</small
            >
          </div>
          <div class="metric teal">
            <span>当月 token 消耗</span
            ><strong>{{ number(dashboard.month_usage.actual_tokens) }}</strong
            ><small>{{ dashboard.month }} · 模型已回传用量</small>
          </div>
        </section>
        <div class="runtime-strip">
          <span
            ><i :class="{ busy: dashboard.running > 0 }" />运行中
            <b>{{ dashboard.running }}</b></span
          ><span :class="{ warning: dashboard.stale_running > 0 }"
            >超时积压 <b>{{ dashboard.stale_running }}</b></span
          ><span class="updated"
            >更新于 {{ dateTime(dashboard.generated_at) }}</span
          >
        </div>
        <div class="chart-grid">
          <section class="card chart-card">
            <div class="section-heading">
              <div>
                <p class="eyebrow">DAILY USAGE</p>
                <h3>当日消耗趋势</h3>
                <p class="muted">按小时统计 · 输入与输出堆叠展示</p>
              </div>
              <el-date-picker
                v-model="selectedDay"
                type="date"
                value-format="YYYY-MM-DD"
                :clearable="false"
                :disabled-date="futureDay"
                @change="loadDashboard"
              />
            </div>
            <AiConsultTokenChart
              :points="dashboard.hourly_trend"
              label="当日每小时 token 消耗趋势"
            />
            <div class="chart-foot">
              <span
                >实际消耗
                <b>{{ number(dashboard.day_usage.actual_tokens) }}</b>
                token</span
              ><span
                >待回传预留 {{ number(dashboard.day_usage.reserved_tokens) }} ·
                {{ dashboard.day_usage.unreported_attempts }} 次</span
              >
            </div>
          </section>
          <section class="card chart-card">
            <div class="section-heading">
              <div>
                <p class="eyebrow">MONTHLY USAGE</p>
                <h3>当月消耗趋势</h3>
                <p class="muted">按自然日统计 · 支持查看历史月份</p>
              </div>
              <el-date-picker
                v-model="selectedMonth"
                type="month"
                value-format="YYYY-MM"
                :clearable="false"
                :disabled-date="futureMonth"
                @change="loadDashboard"
              />
            </div>
            <AiConsultTokenChart
              :points="dashboard.daily_trend"
              label="当月每日 token 消耗趋势"
            />
            <div class="chart-foot">
              <span
                >实际消耗
                <b>{{ number(dashboard.month_usage.actual_tokens) }}</b>
                token</span
              ><span
                >待回传预留
                {{ number(dashboard.month_usage.reserved_tokens) }} ·
                {{ dashboard.month_usage.unreported_attempts }} 次</span
              >
            </div>
          </section>
        </div>
        <p class="usage-note">
          统计按生成开始时间归属；包含重试的实际用量。未回传用量单独显示为预留额度，不计入实际消耗；未来时段留空。此处并非服务商账单。
        </p>
      </template>
      <section class="card sessions-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">CONSULTATION RECORDS</p>
            <h3>
              用户会话 <span class="count">{{ number(total) }}</span>
            </h3>
            <p class="muted">离开 AI 页面或 10 分钟没有新对话时，会话结束；问答记录长期保留。</p>
          </div>
          <el-tag type="info" effect="plain">仅后台可查看</el-tag>
        </div>
        <form class="filters" @submit.prevent="search">
          <el-input
            v-model="filters.report"
            placeholder="报告编号（精确匹配）"
            aria-label="报告编号"
            clearable
            class="report-filter"
          />
          <el-input
            v-model="filters.customer"
            placeholder="用户 ID"
            aria-label="用户 ID"
            clearable
            class="customer-filter"
          />
          <el-select
            v-model="filters.state"
            placeholder="全部会话状态"
            aria-label="会话状态"
            clearable
            class="state-filter"
            ><el-option
              v-for="(name, key) in stateLabels"
              :key="key"
              :value="key"
              :label="name"
          /></el-select>
          <el-button native-type="submit" type="primary">查询</el-button
          ><el-button @click="resetFilters">重置</el-button>
        </form>
        <p v-if="filterError" class="filter-error" role="alert">
          {{ filterError }}
        </p>
        <el-alert
          v-if="sessionsError"
          :title="sessionsError"
          type="error"
          :closable="false"
          show-icon
        />
        <el-table
          v-loading="sessionsLoading"
          :data="sessions"
          row-key="id"
          empty-text="暂无符合条件的会话"
          class="session-table"
        >
          <el-table-column label="报告 / 用户" min-width="280"
            ><template #default="{ row }"
              ><div class="report-code">{{ row.report_code }}</div>
              <div class="table-sub">
                用户 ID：{{ row.customer_id }} · 报告日期 {{ row.report_date }}
              </div></template
            ></el-table-column
          >
          <el-table-column label="咨询入口" min-width="100"
            ><template #default="{ row }">{{
              sourceLabel(row.source)
            }}</template></el-table-column
          >
          <el-table-column prop="turn_count" label="问答轮次" width="92" />
          <el-table-column label="实际 token" min-width="140"
            ><template #default="{ row }"
              ><b class="token-number">{{ number(row.usage.actual_tokens) }}</b>
              <div v-if="row.usage.unreported_attempts" class="table-sub">
                另有预留 {{ number(row.usage.reserved_tokens) }}
              </div></template
            ></el-table-column
          >
          <el-table-column label="会话状态" width="112"
            ><template #default="{ row }"
              ><el-tag :type="stateType(row.state)" effect="light">{{
                stateLabels[row.state]
              }}</el-tag></template
            ></el-table-column
          >
          <el-table-column label="最近活动" width="176"
            ><template #default="{ row }">{{
              dateTime(row.last_activity_at)
            }}</template></el-table-column
          >
          <el-table-column label="操作" width="110" fixed="right"
            ><template #default="{ row }"
              ><el-button
                v-if="canReadConversation"
                link
                type="primary"
                @click="openDetail(row)"
                >查看对话</el-button
              ><span v-else class="table-sub">需对话权限</span></template
            ></el-table-column
          >
        </el-table>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @current-change="loadSessions"
          @size-change="changePageSize"
        />
      </section>
    </template>
    <el-drawer
      v-model="drawerOpen"
      title="会话对话详情"
      size="min(860px, 100vw)"
      destroy-on-close
      @closed="clearDetail"
    >
      <div v-if="detail" class="conversation">
        <div class="session-summary">
          <div>
            <span>报告编号</span><b>{{ detail.session.report_code }}</b>
          </div>
          <div>
            <span>用户 ID / 入口</span
            ><b
              >{{ detail.session.customer_id }} ·
              {{ sourceLabel(detail.session.source) }}</b
            >
          </div>
          <div>
            <span>建立时间</span
            ><b>{{ dateTime(detail.session.created_at) }}</b>
          </div>
          <div>
            <span>实际 token / 问答轮次</span
            ><b
              >{{ number(detail.session.usage.actual_tokens) }} /
              {{ detail.session.turn_count }}</b
            >
          </div>
          <p>会话 ID：{{ detail.session.id }}</p>
        </div>
        <p class="privacy-note">
          包含健康相关咨询内容，仅限授权管理用途。查看操作会记录审计；不会向报告访问者开放历史会话。
        </p>
        <el-empty
          v-if="!detail.turns.length"
          description="这个会话尚未提交问题"
          :image-size="80"
        />
        <article v-for="turn in detail.turns" :key="turn.id" class="turn">
          <div class="turn-heading">
            <span
              >第 {{ turn.sequence }} 轮 · {{ dateTime(turn.created_at) }}</span
            ><el-tag size="small" :type="turnStateType(turn.status)">{{
              turnStatus(turn.status)
            }}</el-tag>
          </div>
          <div class="question bubble">
            <span class="speaker">用户提问</span>
            <p>{{ turn.question }}</p>
          </div>
          <div class="answer bubble">
            <span class="speaker">AI 回答</span>
            <p>{{ turn.answer || "本轮没有已保存的完整回答。" }}</p>
            <div v-if="turn.status === 'failed'" class="turn-failure">
              <strong>失败原因</strong>
              <span>{{ turnFailureReason(turn) }}</span>
            </div>
            <div v-if="turn.evidence.length" class="evidence">
              <span v-for="(item, index) in turn.evidence" :key="index">{{
                item.label
              }}</span>
            </div>
            <div v-if="turn.feedback" class="feedback">
              <span>用户反馈：</span>
              <el-tag
                size="small"
                effect="light"
                :type="feedbackType(turn.feedback)"
              >
                {{ feedbackLabel(turn.feedback) }}
              </el-tag>
            </div>
          </div>
          <details v-if="turn.attempts.length" class="attempts">
            <summary>
              生成记录与 token 用量（{{ turn.attempts.length }} 次）
            </summary>
            <div v-for="attempt in turn.attempts" :key="attempt.attempt_number">
              <b
                >第 {{ attempt.attempt_number }} 次 ·
                {{ turnStatus(attempt.status) }}</b
              ><span>{{ attempt.model_code || "未记录模型" }}</span
              ><span v-if="attempt.actual_tokens !== null"
                >输入 {{ number(attempt.input_tokens) }} / 输出
                {{ number(attempt.output_tokens) }}</span
              ><span v-else
                >用量待回传 · 预留 {{ number(attempt.reserved_tokens) }}</span
              ><span v-if="attempt.error_category">{{
                failureLabel(attempt.error_category)
              }}</span>
            </div>
          </details>
        </article>
        <el-button
          v-if="detail.has_more"
          class="load-more"
          :loading="detailLoading"
          @click="readDetail(true)"
          >加载更多对话</el-button
        >
        <p v-else-if="detail.turns.length" class="end-note">
          已展示全部 {{ detail.turns.length }} 轮对话
        </p>
      </div>
      <el-skeleton v-if="detailLoading && !detail" :rows="10" animated />
      <div v-if="detailError" class="detail-error">
        <el-alert
          :title="detailError"
          type="error"
          :closable="false"
        /><el-button @click="readDetail(!!detail)">重新加载</el-button>
      </div>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { findRoleMenuId } from "@/views/system/roleMenuPermissions";
import {
  fetchAiConsultDashboard,
  fetchAiConsultSessions,
  fetchAiConsultSessionDetail,
  type AiConsultDashboard,
  type AiConsultSessionRow,
  type AiConsultSessionQuery,
  type AiConsultSessionDetail,
  type AiConsultAdminTurn,
} from "@/api/aiConsult";
import AiConsultTokenChart from "./AiConsultTokenChart.vue";
const auth = useAuthStore();
const menuId = computed(() =>
  findRoleMenuId(auth.menus, "/health/ai-consult-overview"),
);
const hasAction = (action: string) =>
  auth.roles.includes("admin") ||
  (menuId.value !== null && auth.hasPermission(String(menuId.value), action));
const canView = computed(() => hasAction("view")),
  canReadConversation = computed(() => hasAction("conversation"));
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const selectedDay = ref(today()),
  selectedMonth = ref(today().slice(0, 7));
const dashboard = ref<AiConsultDashboard | null>(null),
  dashboardLoading = ref(false),
  dashboardError = ref("");
const sessions = ref<AiConsultSessionRow[]>([]),
  total = ref(0),
  page = ref(1),
  pageSize = ref(10),
  sessionsLoading = ref(false),
  sessionsError = ref(""),
  filterError = ref("");
const filters = reactive({
  report: "",
  customer: "",
  state: "",
});
let appliedFilters: AiConsultSessionQuery = {};
let dashboardRequest = 0,
  sessionRequest = 0,
  detailRequest = 0;
const drawerOpen = ref(false),
  detailLoading = ref(false),
  detailError = ref(""),
  detail = ref<AiConsultSessionDetail | null>(null),
  selectedSessionId = ref("");
const stateLabels: Record<string, string> = {
  ended: "已结束",
  active: "进行中",
  empty: "未提问",
};
const number = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("zh-CN");
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
const sourceLabel = (value: string) =>
  (
    ({
      home: "报告首页",
      indicator: "单项指标",
      plan: "健康管理方案",
    }) as Record<string, string>
  )[value] || "报告咨询";
const stateType = (value: string) =>
  value === "ended" ? "success" : value === "active" ? "primary" : "info";
const turnStatus = (value: string) =>
  (
    ({
      completed: "已完成",
      failed: "失败",
      running: "生成中",
      pending: "待生成",
      blocked: "已拦截",
      cancelled: "已停止",
    }) as Record<string, string>
  )[value] || "未完成";
const turnStateType = (value: string) =>
  value === "completed" ? "success" : value === "failed" ? "danger" : "info";
const feedbackType = (value: string) =>
  value === "helpful" ? "success" : value === "unhelpful" ? "danger" : "info";
const feedbackLabel = (value: string) =>
  value === "helpful"
    ? "有帮助"
    : value === "unhelpful"
      ? "没有帮助"
      : "已反馈";
const failureLabel = (value: string) =>
  (
    ({
      worker_timeout: "生成超时",
      timeout: "请求超时",
      provider_unavailable: "模型服务不可用",
      report_unavailable: "报告依据不可用",
      unsafe_answer: "回答未通过审核",
      insufficient_evidence: "依据不足",
      private_input: "输入包含敏感信息",
      emergency: "紧急情况转介",
      clinical_boundary: "医疗边界",
      longevity_boundary: "寿命预测边界",
      session_ended: "会话已结束",
      user_stopped: "用户停止生成",
    }) as Record<string, string>
  )[value] || "其他失败";
const turnFailureReason = (turn: AiConsultAdminTurn) => {
  const failedAttempt = [...turn.attempts]
    .reverse()
    .find((attempt) => attempt.status === "failed" && attempt.error_category);
  return failedAttempt?.error_category
    ? failureLabel(failedAttempt.error_category)
    : "暂无失败原因记录";
};
const futureDay = (date: Date) =>
  date.getTime() > new Date(`${today()}T23:59:59+08:00`).getTime();
const futureMonth = (date: Date) =>
  date.getFullYear() * 12 + date.getMonth() >
  Number(today().slice(0, 4)) * 12 + Number(today().slice(5, 7)) - 1;
async function loadDashboard() {
  if (!canView.value) return;
  const request = ++dashboardRequest;
  dashboardLoading.value = true;
  dashboardError.value = "";
  dashboard.value = null;
  try {
    const response = await fetchAiConsultDashboard({
      day: selectedDay.value,
      month: selectedMonth.value,
    });
    if (request === dashboardRequest) dashboard.value = response.data;
  } catch {
    if (request === dashboardRequest)
      dashboardError.value = "用量统计暂时不可用，请稍后刷新。";
  } finally {
    if (request === dashboardRequest) dashboardLoading.value = false;
  }
}
async function loadSessions() {
  if (!canView.value) return;
  const request = ++sessionRequest;
  sessionsLoading.value = true;
  sessionsError.value = "";
  try {
    const response = await fetchAiConsultSessions({
      ...appliedFilters,
      page: page.value,
      page_size: pageSize.value,
    });
    if (request === sessionRequest) {
      sessions.value = response.data.records;
      total.value = response.data.total;
    }
  } catch {
    if (request === sessionRequest) {
      sessions.value = [];
      total.value = 0;
      sessionsError.value = "会话列表暂时不可用，请稍后刷新。";
    }
  } finally {
    if (request === sessionRequest) sessionsLoading.value = false;
  }
}
function search() {
  filterError.value = "";
  const customer = filters.customer.trim();
  if (
    customer &&
    (!/^\d+$/.test(customer) ||
      !Number.isSafeInteger(Number(customer)) ||
      Number(customer) <= 0)
  ) {
    filterError.value = "请输入有效的正整数用户 ID。";
    return;
  }
  appliedFilters = {
    ...(filters.report.trim() ? { report_code: filters.report.trim() } : {}),
    ...(customer ? { customer_id: Number(customer) } : {}),
    ...(filters.state ? { state: filters.state } : {}),
  };
  page.value = 1;
  loadSessions();
}
function resetFilters() {
  Object.assign(filters, { report: "", customer: "", state: "" });
  search();
}
function changePageSize() {
  page.value = 1;
  loadSessions();
}
async function refresh() {
  await Promise.all([loadDashboard(), loadSessions()]);
}
function openDetail(row: AiConsultSessionRow) {
  if (!canReadConversation.value) return;
  selectedSessionId.value = row.id;
  detail.value = null;
  drawerOpen.value = true;
  readDetail(false);
}
async function readDetail(more = false) {
  if (
    !canReadConversation.value ||
    !selectedSessionId.value ||
    (more && detailLoading.value)
  )
    return;
  const request = ++detailRequest,
    id = selectedSessionId.value,
    offset = more ? detail.value?.turns.length || 0 : 0;
  if (!more) detail.value = null;
  detailLoading.value = true;
  detailError.value = "";
  try {
    const response = await fetchAiConsultSessionDetail(id, {
      offset,
      limit: 30,
    });
    if (
      request !== detailRequest ||
      id !== selectedSessionId.value ||
      !drawerOpen.value
    )
      return;
    if (more && detail.value) {
      const ids = new Set(detail.value.turns.map((turn) => turn.id));
      detail.value = {
        ...response.data,
        turns: [
          ...detail.value.turns,
          ...response.data.turns.filter((turn) => !ids.has(turn.id)),
        ],
      };
    } else detail.value = response.data;
  } catch (error: any) {
    if (request === detailRequest)
      detailError.value =
        error?.response?.status === 403 ||
        error?.code === 403 ||
        error?.detail === "consult.admin_forbidden"
          ? "没有查看完整对话的权限，请联系管理员。"
          : "对话详情暂时不可用，请稍后重试。";
  } finally {
    if (request === detailRequest) detailLoading.value = false;
  }
}
function clearDetail() {
  ++detailRequest;
  detail.value = null;
  selectedSessionId.value = "";
  detailError.value = "";
  detailLoading.value = false;
}
onMounted(refresh);
</script>
<style scoped>
/* Operations dashboard: actual usage, report-bound sessions and private detail. */
.overview {
  max-width: 1480px;
  margin: 0 auto;
  color: #33445e;
}
.page-heading,
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
}
.page-heading {
  margin-bottom: 22px;
}
.eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #93a0b6;
}
h2 {
  margin: 7px 0;
  font-size: 25px;
  color: #243651;
}
h3 {
  margin: 7px 0 6px;
  font-size: 17px;
  color: #2c405d;
}
.muted {
  margin: 0;
  color: #718199;
  font-size: 13px;
  line-height: 1.6;
}
.heading-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-top: 12px;
}
.zone {
  font-size: 12px;
  color: #718199;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}
.metric,
.card {
  min-width: 0;
  background: #fff;
  border: 1px solid #e7ecf5;
  border-radius: 17px;
  padding: 24px;
  box-shadow: 0 5px 20px #3b527306;
}
.metric {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.metric > span {
  color: #8290a6;
  font-size: 13px;
}
.metric strong {
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.03em;
  color: #355986;
  font-variant-numeric: tabular-nums;
}
.metric small {
  color: #718199;
  font-size: 13px;
  line-height: 1.5;
}
.metric.accent {
  background: linear-gradient(135deg, #fff, #f1f6ff);
}
.metric.teal {
  background: linear-gradient(135deg, #fff, #f1f9f8);
}
.metric.teal strong {
  color: #428d8b;
}
.runtime-strip {
  display: flex;
  align-items: center;
  gap: 24px;
  margin: 16px 4px 20px;
  font-size: 13px;
  color: #718199;
}
.runtime-strip b {
  color: #506683;
  margin-left: 7px;
  font-weight: 600;
}
.runtime-strip i {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #76b7a8;
  margin-right: 7px;
}
.runtime-strip i.busy {
  background: #729cdd;
}
.runtime-strip .warning,
.runtime-strip .warning b {
  color: #c08d4c;
}
.updated {
  margin-left: auto;
  font-size: 12px;
}
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.chart-card .section-heading {
  margin-bottom: 25px;
}
.chart-card :deep(.el-date-editor) {
  width: 140px;
  flex: none;
}
.chart-foot {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  border-top: 1px solid #eef2f7;
  margin-top: 17px;
  padding-top: 16px;
  font-size: 13px;
  line-height: 1.55;
  color: #718199;
}
.chart-foot b {
  color: #57749a;
  font-size: 15px;
  margin: 0 5px;
}
.usage-note {
  margin: 12px 4px 25px;
  font-size: 13px;
  line-height: 1.7;
  color: #718199;
}
.sessions-card > .section-heading {
  margin-bottom: 22px;
}
.count {
  font-size: 13px;
  font-weight: 500;
  color: #7b95b7;
  padding: 3px 9px;
  background: #f1f5fb;
  border-radius: 20px;
  margin-left: 6px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 17px;
  background: #f7f9fc;
  border-radius: 12px;
  margin-bottom: 18px;
}
.report-filter {
  width: 230px;
}
.customer-filter {
  width: 125px;
}
.state-filter {
  width: 136px;
}
.filters :deep(.el-date-editor) {
  width: 265px;
  flex: none;
}
.filters :deep(.el-button + .el-button) {
  margin-left: 0;
}
.filter-error {
  color: #b86052;
  font-size: 13px;
}
.report-code {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  overflow-wrap: anywhere;
  color: #425b7b;
}
.table-sub {
  margin-top: 5px;
  color: #718199;
  font-size: 13px;
  line-height: 1.6;
}
.token-number {
  color: #526f97;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.session-table {
  font-size: 13px;
}
.session-table :deep(th.el-table__cell) {
  background: #f8fafd;
  color: #8b98ac;
  font-weight: 500;
  padding: 13px 0;
}
.session-table :deep(td.el-table__cell) {
  padding: 17px 0;
}
.session-table :deep(.el-button) {
  font-size: 13px;
}
.el-pagination {
  justify-content: flex-end;
  margin-top: 20px;
  flex-wrap: wrap;
  row-gap: 10px;
}
.session-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  padding: 22px;
  background: #f5f8fc;
  border-radius: 14px;
}
.session-summary div {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}
.session-summary span {
  color: #718199;
  font-size: 13px;
}
.session-summary b {
  color: #4e6789;
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.session-summary p {
  grid-column: 1/-1;
  font-size: 12px;
  line-height: 1.6;
  color: #718199;
  margin: 0;
  overflow-wrap: anywhere;
}
.privacy-note {
  font-size: 13px;
  line-height: 1.7;
  color: #718199;
  margin: 15px 3px 30px;
}
.turn {
  margin-bottom: 30px;
}
.turn-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #718199;
}
.bubble {
  padding: 18px 20px;
  border-radius: 14px;
  overflow-wrap: anywhere;
}
.bubble .speaker {
  font-size: 13px;
  color: #8c9db6;
}
.bubble p {
  white-space: pre-wrap;
  line-height: 1.9;
  font-size: 13px;
  margin: 8px 0 0;
  color: #405878;
}
.question {
  background: #eef4ff;
  margin-left: 42px;
  margin-bottom: 12px;
}
.answer {
  background: #f7f9fc;
  margin-right: 30px;
}
.turn-failure {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding: 9px 11px;
  border: 1px solid #f5d0cd;
  border-radius: 8px;
  background: #fff5f4;
  color: #bd514a;
  font-size: 12px;
  line-height: 1.6;
}
.turn-failure strong {
  font-weight: 650;
}
.evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 15px;
}
.evidence span {
  padding: 4px 8px;
  background: #edf2f8;
  border-radius: 5px;
  font-size: 12px;
  color: #718199;
}
.feedback {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #718199;
  margin-top: 12px;
}
.attempts {
  margin: 13px 0 0;
  color: #718199;
  font-size: 13px;
}
.attempts summary {
  cursor: pointer;
}
.attempts > div {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #edf1f7;
}
.attempts b {
  font-weight: 500;
  color: #7e91aa;
}
.load-more {
  display: block;
  margin: 15px auto;
}
.end-note {
  text-align: center;
  font-size: 13px;
  color: #718199;
}
.detail-error .el-button {
  margin-top: 12px;
}
@media (max-width: 1100px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
  .metric {
    padding: 19px;
  }
  .metric strong {
    font-size: 27px;
  }
}
@media (max-width: 700px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .page-heading {
    flex-direction: column;
  }
  .heading-actions {
    padding-top: 0;
  }
  .card {
    padding: 18px;
  }
  .runtime-strip {
    flex-wrap: wrap;
    gap: 12px;
  }
  .updated {
    margin-left: 0;
  }
  .chart-card .section-heading {
    flex-wrap: wrap;
  }
  .session-summary {
    grid-template-columns: 1fr;
  }
  .question {
    margin-left: 15px;
  }
  .answer {
    margin-right: 10px;
  }
  .filters {
    padding: 12px;
  }
  .report-filter {
    width: 100%;
  }
}
</style>
