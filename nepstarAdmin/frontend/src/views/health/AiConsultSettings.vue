<template>
  <div class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">AI SERVICE / CONTROL PLANE</p>
        <h2 class="page-title">AI 咨询服务设置</h2>
        <p class="page-subtitle">控制前台 AI 咨询启停、维护问答额度与回答规则；模型密钥只保存在服务端。</p>
      </div>
      <el-tag :type="settings.enabled ? 'success' : 'info'" effect="light" round>
        {{ settings.enabled ? (runtime.can_enable ? '服务已启用' : '已启用 · 环境阻断') : '服务未开放' }}
      </el-tag>
    </div>

    <el-alert
      v-if="!canViewSettings"
      type="error"
      :closable="false"
      show-icon
      title="没有查看 AI 咨询设置的权限。"
      description="请联系系统管理员分配此页面的查看权限。"
    />

    <el-alert
      v-if="canViewSettings && !runtime.can_enable"
      class="status-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="runtime.activation_block_reason || '服务仍处于保护关闭状态。'"
      description="开启前需排除以上阻断；紧急关闭始终可用。部署环境显式禁用时，后台不能绕过。"
    />

    <section v-if="canViewSettings" class="card service-card" :class="{ 'service-card--on': settings.enabled }">
      <div class="service-copy">
        <span class="section-kicker">SERVICE CONTROL</span>
        <h3>前台 AI 咨询开关</h3>
        <p>{{ !settings.configured ? '新建设置默认开启；首次保存设置后生效，运行环境未就绪时前台仍不可用。' : settings.enabled && !runtime.can_enable ? '开关已开启，但运行环境未就绪，前台暂不可用。' : settings.enabled ? '正在开放咨询。出现异常时，可在此立即暂停新提问和重试。' : '咨询已关闭。开启后，报告访问者才可使用 AI 咨询。' }}</p>
        <p class="service-note">关闭不删除历史问答；尚未通过发布检查的回答将被拦截。已发给模型的请求不能保证立即取消或退还用量。</p>
        <p class="service-note">仅控制当前管理端连接的 API；报告端若连接线上域名，请在同一线上后台操作。</p>
        <p v-if="!canEditSettings" class="hint">仅有查看权限，请联系有编辑权限的管理员操作。</p>
      </div>
      <div class="service-toggle">
        <el-switch
          :model-value="settings.enabled"
          data-testid="consult-service-switch"
          :loading="switching"
          :disabled="!canEditSettings || !loaded || loading || saving || switching || !settings.configured || (!settings.enabled && !runtime.can_enable)"
          :before-change="toggleService"
          inline-prompt active-text="开启" inactive-text="关闭"
          aria-label="前台 AI 咨询开关"
          style="--el-switch-on-color:#27a2a8; --el-switch-off-color:#a4afbd"
        />
        <span>{{ !settings.configured ? '待初始化' : switching ? '正在保存…' : settings.enabled && !runtime.can_enable ? '待运行环境' : settings.enabled ? '已开启' : '已关闭' }}</span>
      </div>
    </section>

    <div v-if="canViewSettings" class="grid">
      <section class="card runtime-card">
        <div class="section-heading"><div><span class="section-kicker">RUNTIME</span><h3>运行环境状态</h3></div><span class="status-orb" /></div>
        <dl class="runtime-list">
          <div><dt>服务商标识</dt><dd>{{ settings.provider_code || '未配置' }}</dd></div>
          <div><dt>模型名称</dt><dd>{{ settings.model_code || '未配置' }}</dd></div>
          <div><dt>告知版本</dt><dd>{{ settings.notice_version || '未配置' }}</dd></div>
          <div><dt>服务端密钥</dt><dd><el-tag :type="runtime.provider_secret_configured ? 'success' : 'info'" size="small">{{ runtime.provider_secret_configured ? '已配置（不回显）' : '未配置' }}</el-tag></dd></div>
          <div><dt>后台配置匹配</dt><dd><el-tag :type="runtime.provider_matches_settings ? 'success' : 'warning'" size="small">{{ runtime.provider_matches_settings ? '匹配' : '未匹配' }}</el-tag></dd></div>
        </dl>
        <div class="gates">
          <span v-for="(enabled, name) in runtime.feature_gates" :key="name" :class="{ on: enabled }">{{ gateLabels[name] }}：{{ enabled ? '允许' : '禁用' }}</span>
        </div>
        <p class="hint">服务商、模型和告知版本为只读配置。部署保护显示“允许”不代表服务已开启；实际启停由上方总开关控制。</p>
      </section>

      <section class="card config-card">
        <div class="section-heading"><div><span class="section-kicker">QUOTAS & ACCESS</span><h3>咨询次数与访问限制</h3></div></div>
        <el-form label-position="top" :model="form" :disabled="!canEditSettings || switching" class="settings-form">
          <el-form-item label="全站每分钟新咨询入口上限" :error="quotaErrors.guest_create_limit_per_minute">
            <el-input-number v-model="form.guest_create_limit_per_minute" data-testid="quota-guest_create_limit_per_minute" :min="0" :max="1000" :precision="0" />
            <span class="inline-hint">保护公开报告咨询入口；0 表示不限制</span>
          </el-form-item>
          <el-form-item label="每访客每天成功回答上限" :error="quotaErrors.daily_success_limit">
            <el-input-number v-model="form.daily_success_limit" data-testid="quota-daily_success_limit" :min="0" :max="1000" :precision="0" />
            <span class="inline-hint">失败回答不占成功次数；0 表示不限制</span>
          </el-form-item>
          <el-form-item label="每访客每分钟提问上限" :error="quotaErrors.per_minute_limit">
            <el-input-number v-model="form.per_minute_limit" data-testid="quota-per_minute_limit" :min="0" :max="60" :precision="0" />
            <span class="inline-hint">失败请求也计入频率；0 表示不限制</span>
          </el-form-item>
          <el-form-item label="全站每日 token 预算" :error="quotaErrors.global_daily_token_limit">
            <el-input-number v-model="form.global_daily_token_limit" data-testid="quota-global_daily_token_limit" :min="0" :max="100000000" :step="10000" :precision="0" />
            <span class="inline-hint">0 表示不限制；生成前预留额度，服务商回报后按实际用量结算</span>
          </el-form-item>
          <el-form-item label="单次提问字数上限" :error="quotaErrors.max_question_chars">
            <el-input-number v-model="form.max_question_chars" data-testid="quota-max_question_chars" :min="0" :max="500" :precision="0" />
            <span class="inline-hint">0 表示不限制；1–500 字，报告端输入限制同步此设置</span>
          </el-form-item>
          <el-form-item label="全站同时生成上限" :error="quotaErrors.max_concurrent_generations">
            <el-input-number v-model="form.max_concurrent_generations" data-testid="quota-max_concurrent_generations" :min="0" :max="100" :precision="0" />
            <span class="inline-hint">限制正在生成的回答数；0 表示不限制</span>
          </el-form-item>
          <div class="form-footer">
            <span v-if="settings.updated_at">最近保存：{{ settings.updated_at }}</span>
            <span v-else>尚未保存配置</span>
            <el-button v-if="canEditSettings" type="primary" :loading="saving" :disabled="loading || switching || !loaded" @click="save">保存额度设置</el-button>
          </div>
        </el-form>
      </section>
    </div>

    <section v-if="canViewSettings" class="card rules-card">
      <div class="section-heading rules-heading">
        <div>
          <span class="section-kicker">ANSWER RULES</span>
          <h3>回答规则版本</h3>
          <p class="rules-subtitle">每个新问题固定当前规则版本；同一问题重试时沿用原版本。发布规则不会开启 AI 服务。</p>
        </div>
        <div class="rules-actions">
          <el-button plain :disabled="loading || auditLoading" @click="openAudit">查看操作记录</el-button>
          <el-button v-if="canEditSettings" type="primary" plain :disabled="loading || rulesLoading" @click="openCreateRule">新建规则草稿</el-button>
        </div>
      </div>
      <el-alert
        v-if="settings.active_rule_version_id === null"
        type="info"
        :closable="false"
        show-icon
        title="尚未发布回答规则；当前使用服务端内置安全约束。"
        class="rules-alert"
      />
      <el-table v-loading="rulesLoading" :data="rules" row-key="id" empty-text="暂无规则版本">
        <el-table-column prop="version" label="版本" min-width="130" />
        <el-table-column label="状态" width="130">
          <template #default="{ row }">
            <el-tag v-if="row.active" type="success" effect="light">当前生效</el-tag>
            <el-tag v-else-if="row.status === 'draft'" type="warning" effect="light">草稿</el-tag>
            <el-tag v-else-if="row.status === 'retired'" type="info" effect="light">已归档</el-tag>
            <el-tag v-else type="info" effect="plain">已发布</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" min-width="180" />
        <el-table-column prop="published_at" label="发布时间" min-width="180">
          <template #default="{ row }">{{ row.published_at || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="canPublishRules ? 230 : 90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openRule(row.id)">查看</el-button>
            <el-button
              v-if="canPublishRules && row.status === 'draft'"
              link
              type="success"
              :loading="ruleActionId === row.id"
              :disabled="ruleActionId !== null"
              @click="changeActiveRule(row, 'publish')"
            >发布</el-button>
            <el-button
              v-else-if="canPublishRules && !row.active && ['published', 'retired'].includes(row.status)"
              link
              type="warning"
              :loading="ruleActionId === row.id"
              :disabled="ruleActionId !== null"
              @click="changeActiveRule(row, 'activate')"
            >回退到此版本</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="ruleDialog"
      :title="ruleDialogMode === 'create' ? '新建规则草稿' : `规则版本 ${selectedRule?.version || ''}`"
      width="min(680px, calc(100vw - 32px))"
      :close-on-click-modal="false"
    >
      <el-form v-if="ruleDialogMode === 'create'" label-position="top" :model="ruleForm">
        <el-form-item label="版本号" required>
          <el-input v-model="ruleForm.version" maxlength="40" placeholder="例如 2026-10-v1" />
        </el-form-item>
        <el-form-item label="回答表达规则" required>
          <el-input v-model="ruleForm.content" type="textarea" :rows="8" maxlength="2000" show-word-limit
            placeholder="仅描述沟通语气与表达方式；不得要求模型编造报告事实、分数或日期，也不得覆盖健康安全边界。" />
        </el-form-item>
        <p class="rules-editor-hint">草稿创建后不可原地修改。请勿粘贴报告编号、手机号或邮箱；发布需要单独的 publish 权限。</p>
      </el-form>
      <div v-else-if="selectedRule" class="rule-detail">
        <div class="rule-detail-meta"><el-tag>{{ selectedRule.status }}</el-tag><code>{{ selectedRule.content_hash }}</code></div>
        <pre>{{ selectedRule.content }}</pre>
      </div>
      <template #footer>
        <el-button @click="ruleDialog = false">关闭</el-button>
        <el-button v-if="ruleDialogMode === 'create'" type="primary" :loading="ruleSaving" @click="saveRuleDraft">保存草稿</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="auditDialog"
      title="管理操作记录"
      width="min(900px, calc(100vw - 32px))"
    >
      <el-table v-loading="auditLoading" :data="auditEntries" row-key="id" empty-text="暂无管理操作记录" max-height="55vh">
        <el-table-column prop="occurred_at" label="操作时间（UTC）" min-width="175" />
        <el-table-column label="操作" width="145">
          <template #default="{ row }">{{ auditActionLabel(row.action) }}</template>
        </el-table-column>
        <el-table-column label="操作人" width="125">
          <template #default="{ row }">管理员 #{{ row.actor_admin_id }}</template>
        </el-table-column>
        <el-table-column prop="target_id" label="对象编号" width="105">
          <template #default="{ row }">{{ row.target_id || '—' }}</template>
        </el-table-column>
        <el-table-column label="变更摘要" min-width="260">
          <template #default="{ row }">{{ auditSummary(row) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div class="audit-footer">
          <span>仅显示配置与规则版本操作，不含聊天内容。</span>
          <div>
            <el-button :disabled="auditLoading || auditOffset === 0" @click="loadAudit(Math.max(0, auditOffset - 20))">上一页</el-button>
            <el-button :disabled="auditLoading || !auditHasMore" @click="loadAudit(auditOffset + 20)">下一页</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import {
  activateAiConsultRuleVersion,
  createAiConsultRuleDraft,
  fetchAiConsultAdminAudit,
  fetchAiConsultRuleVersion,
  fetchAiConsultRuleVersions,
  fetchAiConsultAdminSettings,
  publishAiConsultRuleVersion,
  updateAiConsultAdminSettings,
  updateAiConsultServiceState,
  type AiConsultAdminSettings,
  type AiConsultAuditEntry,
  type AiConsultRuntimeStatus,
  type AiConsultRuleDetail,
  type AiConsultRuleVersion,
} from '@/api/aiConsult';

const loading = ref(false);
const loaded = ref(false);
const switching = ref(false);
const authStore = useAuthStore();
const settingsMenuPath = '/health/ai-consult-settings';

function findMenuId(menus: any[], routePath: string): number | null {
  for (const menu of menus) {
    if (menu.route_path === routePath) return Number(menu.id);
    const nested = findMenuId(menu.children || [], routePath);
    if (nested !== null) return nested;
  }
  return null;
}

const settingsMenuId = computed(() => findMenuId(authStore.menus, settingsMenuPath));
function hasSettingsAction(action: string) {
  if (authStore.roles.includes('admin')) return true;
  return settingsMenuId.value !== null
    && authStore.hasPermission(String(settingsMenuId.value), action);
}

const canViewSettings = computed(() => hasSettingsAction('view'));
const canEditSettings = computed(() => hasSettingsAction('edit'));
const canPublishRules = computed(() => hasSettingsAction('publish'));
const saving = ref(false);
const settings = reactive<AiConsultAdminSettings>({
  configured: false, id: 1, enabled: true, provider_code: 'openai_compatible', model_code: '',
  maintenance_text: '', notice_version: '', notice_text: '', data_scope_text: '',
  guest_create_limit_per_minute: 0, row_version: 0, updated_at: null,
  daily_success_limit: 0, per_minute_limit: 0, global_daily_token_limit: 0,
  max_concurrent_generations: 0, max_question_chars: 500,
  active_rule_version_id: null,
});
const runtime = reactive<AiConsultRuntimeStatus>({
  provider_code: 'disabled', model_code: null, provider_secret_configured: false,
  provider_matches_settings: false, feature_gates: { guest: false, sessions: false, answers: false, operations: false },
  can_enable: false, activation_block_reason: '',
});
const form = reactive({
  daily_success_limit: 0, per_minute_limit: 0, global_daily_token_limit: 0,
  max_question_chars: 500, guest_create_limit_per_minute: 0, max_concurrent_generations: 0,
});
const quotaBounds = {
  guest_create_limit_per_minute: [0, 1000],
  daily_success_limit: [0, 1000],
  per_minute_limit: [0, 60],
  global_daily_token_limit: [0, 100000000],
  max_question_chars: [0, 500],
  max_concurrent_generations: [0, 100],
} as const;
type QuotaField = keyof typeof quotaBounds;
const quotaErrors = reactive<Partial<Record<QuotaField, string>>>({});
function quotaError(field: QuotaField) {
  const [min, max] = quotaBounds[field];
  return `请输入 ${min}–${max} 之间的整数`;
}
function validateQuotas() {
  for (const field of Object.keys(quotaBounds) as QuotaField[]) {
    delete quotaErrors[field];
    const [min, max] = quotaBounds[field];
    const value = form[field];
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      quotaErrors[field] = quotaError(field);
    }
  }
  return Object.keys(quotaErrors).length === 0;
}
const gateLabels: Record<string, string> = { guest: '匿名入口', sessions: '会话', answers: '问答', operations: '运营保护' };
const rules = ref<AiConsultRuleVersion[]>([]);
const rulesLoading = ref(false);
const ruleSaving = ref(false);
const ruleActionId = ref<number | null>(null);
const ruleDialog = ref(false);
const ruleDialogMode = ref<'create' | 'view'>('create');
const selectedRule = ref<AiConsultRuleDetail | null>(null);
const ruleForm = reactive({ version: '', content: '' });
const auditDialog = ref(false);
const auditLoading = ref(false);
const auditEntries = ref<AiConsultAuditEntry[]>([]);
const auditOffset = ref(0);
const auditHasMore = ref(false);

function apply(data: { settings: AiConsultAdminSettings; runtime: AiConsultRuntimeStatus }, resetForm = true) {
  Object.assign(settings, data.settings);
  Object.assign(runtime, data.runtime);
  if (resetForm) Object.assign(form, {
    daily_success_limit: data.settings.daily_success_limit,
    per_minute_limit: data.settings.per_minute_limit,
    global_daily_token_limit: data.settings.global_daily_token_limit,
    max_question_chars: data.settings.max_question_chars ?? 500,
    guest_create_limit_per_minute: data.settings.guest_create_limit_per_minute,
    max_concurrent_generations: data.settings.max_concurrent_generations,
  });
  for (const field of Object.keys(quotaErrors) as QuotaField[]) delete quotaErrors[field];
}

async function load() {
  if (!canViewSettings.value) return;
  loading.value = true;
  try {
    const response = await fetchAiConsultAdminSettings();
    apply(response.data);
    loaded.value = true;
    await loadRules();
  } catch (error: any) {
    ElMessage.error(error?.detail || error?.message || '读取设置失败，请稍后重试。');
  } finally {
    loading.value = false;
  }
}

async function loadRules() {
  rulesLoading.value = true;
  try {
    const response = await fetchAiConsultRuleVersions({ limit: 50, offset: 0 });
    rules.value = response.data.rules;
  } catch (error: any) {
    ElMessage.error(error?.detail || error?.message || '读取回答规则版本失败。');
  } finally {
    rulesLoading.value = false;
  }
}

async function openAudit() {
  auditDialog.value = true;
  await loadAudit(0);
}

async function loadAudit(offset: number) {
  auditLoading.value = true;
  try {
    const response = await fetchAiConsultAdminAudit({ limit: 20, offset });
    auditEntries.value = response.data.entries;
    auditOffset.value = response.data.offset;
    auditHasMore.value = response.data.has_more;
  } catch (error: any) {
    ElMessage.error(error?.detail || error?.message || '读取管理操作记录失败。');
  } finally {
    auditLoading.value = false;
  }
}

function auditActionLabel(action: AiConsultAuditEntry['action']) {
  const labels: Record<AiConsultAuditEntry['action'], string> = {
    'settings.update': '更新候选设置',
    'service.pause': '关闭 AI 咨询',
    'service.resume': '开启 AI 咨询',
    'rule.draft_create': '创建规则草稿',
    'rule.publish': '发布规则',
    'rule.activate': '切换规则版本',
    unknown: '其他操作',
  };
  return labels[action] || labels.unknown;
}

function auditSummary(entry: AiConsultAuditEntry) {
  const summary = entry.change_summary;
  if (['settings.update', 'service.pause', 'service.resume'].includes(entry.action)) {
    const fieldLabels: Record<string, string> = {
      enabled: '服务状态',
      provider_code: '服务商',
      model_code: '模型名称',
      maintenance_text: '维护提示',
      notice_version: '告知版本',
      notice_text: '告知说明',
      data_scope_text: '数据范围说明',
      guest_create_limit_per_minute: '匿名入口频率上限',
      daily_success_limit: '每日成功回答上限',
      per_minute_limit: '每分钟提问上限',
      global_daily_token_limit: '全站每日 token 预算',
      max_concurrent_generations: '全站并发上限',
      max_question_chars: '单次提问字数上限',
    };
    const fields = summary.changed_fields?.map((field) => fieldLabels[field] || field).join('、') || '无字段变化';
    const versions = summary.from_row_version !== undefined && summary.to_row_version !== undefined
      ? `；配置版本 ${summary.from_row_version} → ${summary.to_row_version}`
      : '';
    return `${fields}${versions}`;
  }
  if (entry.action === 'rule.draft_create') {
    const length = summary.content_length === undefined ? '' : `（${summary.content_length} 字）`;
    return `规则 ${summary.version || '—'}${length}`;
  }
  if (entry.action === 'rule.publish' || entry.action === 'rule.activate') {
    const from = summary.from_rule_version_id ?? '无';
    const to = summary.to_rule_version_id ?? entry.target_id ?? '—';
    const versions = summary.from_row_version !== undefined && summary.to_row_version !== undefined
      ? `；配置版本 ${summary.from_row_version} → ${summary.to_row_version}`
      : '';
    return `规则版本 ${from} → ${to}${versions}`;
  }
  return '无可展示的摘要';
}

function openCreateRule() {
  ruleDialogMode.value = 'create';
  selectedRule.value = null;
  ruleForm.version = '';
  ruleForm.content = '';
  ruleDialog.value = true;
}

async function openRule(id: number) {
  try {
    const response = await fetchAiConsultRuleVersion(id);
    selectedRule.value = response.data;
    ruleDialogMode.value = 'view';
    ruleDialog.value = true;
  } catch (error: any) {
    ElMessage.error(error?.detail || error?.message || '读取规则正文失败。');
  }
}

async function saveRuleDraft() {
  const version = ruleForm.version.trim();
  const content = ruleForm.content.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(version) || !content) {
    ElMessage.warning('请填写有效版本号和规则内容。');
    return;
  }
  ruleSaving.value = true;
  try {
    await createAiConsultRuleDraft({ version, content });
    ruleDialog.value = false;
    ElMessage.success('规则草稿已保存。');
    await loadRules();
  } catch (error: any) {
    ElMessage.error(error?.detail || error?.message || '保存规则草稿失败。');
  } finally {
    ruleSaving.value = false;
  }
}

async function changeActiveRule(rule: AiConsultRuleVersion, action: 'publish' | 'activate') {
  const isPublish = action === 'publish';
  try {
    await ElMessageBox.confirm(
      isPublish
        ? `确认发布规则 ${rule.version}？新问题将使用该版本，重试仍使用原问题版本。`
        : `确认切换到规则 ${rule.version}？此操作不会改写历史回答。`,
      isPublish ? '发布规则' : '切换规则版本',
      { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  ruleActionId.value = rule.id;
  try {
    const response = isPublish
      ? await publishAiConsultRuleVersion(rule.id, settings.row_version)
      : await activateAiConsultRuleVersion(rule.id, settings.row_version);
    settings.active_rule_version_id = response.data.active_rule_version_id;
    settings.row_version = response.data.row_version;
    ElMessage.success(isPublish ? '规则已发布。' : '规则版本已切换。');
    await load();
  } catch (error: any) {
    ElMessage.error(error?.detail || error?.message || '切换规则版本失败，请刷新后重试。');
  } finally {
    ruleActionId.value = null;
  }
}

async function save() {
  if (!canEditSettings.value || !loaded.value || loading.value || saving.value || switching.value) return;
  if (!validateQuotas()) {
    ElMessage.warning('请检查标记的额度项。');
    return;
  }
  saving.value = true;
  try {
    const response = await updateAiConsultAdminSettings({
      ...form,
      // These identifiers are displayed read-only in the runtime panel.
      provider_code: settings.provider_code,
      model_code: settings.model_code,
      notice_version: settings.notice_version,
      maintenance_text: settings.maintenance_text,
      notice_text: settings.notice_text,
      data_scope_text: settings.data_scope_text,
      enabled: settings.enabled,
      expected_row_version: settings.row_version,
    });
    apply(response.data);
    ElMessage.success('额度设置已保存；服务启停状态未改变。');
  } catch (error: any) {
    const detail = error?.detail ?? error?.response?.data?.detail;
    if (Array.isArray(detail)) {
      for (const issue of detail) {
        const field = issue?.loc?.[issue.loc.length - 1];
        if (typeof field === 'string' && Object.prototype.hasOwnProperty.call(quotaBounds, field)) {
          quotaErrors[field as QuotaField] = quotaError(field as QuotaField);
        }
      }
      ElMessage.error(Object.keys(quotaErrors).length
        ? '配置未保存，请检查标记的额度项。'
        : '配置未保存，请检查输入内容。');
      return;
    }
    const message = detail || error?.response?.data?.message || error?.message;
    ElMessage.error(message === 'consult.admin_version_conflict'
      ? '配置已被其他管理员更新，请刷新后重试。'
      : message || '保存失败，请稍后重试。');
  } finally {
    saving.value = false;
  }
}

async function toggleService() {
  if (!canEditSettings.value || !loaded.value || loading.value || saving.value || switching.value) return false;
  const enabled = !settings.enabled;
  if (enabled && !runtime.can_enable) return false;
  switching.value = true;
  try {
    await ElMessageBox.confirm(
      enabled
        ? '确认开启前台 AI 咨询？请确认当前 API 环境、数据处理审批和服务配置已就绪。'
        : '确认关闭前台 AI 咨询？新提问和重试将被暂停，尚未完成的回答不会继续发布；历史记录保留。',
      enabled ? '开启 AI 咨询' : '紧急关闭 AI 咨询',
      { type: 'warning', confirmButtonText: enabled ? '确认开启' : '确认关闭', cancelButtonText: '取消' },
    );
    const response = await updateAiConsultServiceState({ enabled, expected_row_version: settings.row_version });
    apply(response.data, false);
    ElMessage.success(enabled ? 'AI 咨询已开启。' : 'AI 咨询已关闭。');
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      const payload = error?.code ? error : error?.response?.data?.code ? error.response.data : error?.response?.code ? error.response : error;
      const message = payload?.message || error?.detail;
      ElMessage.error(message === 'consult.admin_version_conflict'
        ? '服务状态已被其他管理员更新，已重新读取，请确认后重试。'
        : payload?.data?.detail || error?.detail || message || '切换失败，服务状态未确认，请刷新后重试。');
      try {
        const current = await fetchAiConsultAdminSettings();
        apply(current.data, false);
      } catch { loaded.value = false; }
    }
  } finally { switching.value = false; }
  // State comes from the server response; never optimistically flip the switch.
  return false;
}

onMounted(load);
</script>

<style scoped>
.page { max-width: 1280px; }
.page-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:22px; }
.eyebrow,.section-kicker { margin:0; color:#8994ab; font-size:11px; font-weight:750; letter-spacing:.16em; }
.page-title { margin:7px 0 6px; color:#202b43; font-size:23px; font-weight:700; }
.page-subtitle { margin:0; color:#78869b; font-size:13px; line-height:1.7; }
.status-alert { margin-bottom:18px; border-radius:12px; }
.service-card { display:flex; justify-content:space-between; align-items:center; gap:28px; margin-bottom:18px; background:linear-gradient(110deg,#fff,#f5f8fc); }
.service-card--on { border-color:#bfe3e4; background:linear-gradient(110deg,#fff,#f0faf9); }
.service-copy h3 { margin:7px 0 8px; color:#293852; font-size:18px; }
.service-copy p { margin:5px 0; color:#65758c; font-size:13px; line-height:1.7; }
.service-copy .service-note { max-width:800px; color:#8995a7; font-size:13px; line-height:1.65; }
.service-toggle { display:flex; flex-direction:column; align-items:center; gap:8px; min-width:84px; color:#65758c; font-size:13px; }
.service-toggle :deep(.el-switch) { --el-switch-width:64px; --el-switch-height:30px; --el-switch-button-size:24px; }
@media (max-width:600px) { .service-card { align-items:flex-start; gap:12px; padding:18px; } .service-toggle { min-width:64px; } }
.grid { display:grid; grid-template-columns:minmax(280px,.75fr) minmax(430px,1.25fr); align-items:stretch; gap:18px; }
.card { min-width:0; padding:22px; border:1px solid #e6ebf3; border-radius:16px; background:#fff; box-shadow:0 5px 20px #33415c08; }
.section-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
.section-heading h3 { margin:6px 0 0; color:#293852; font-size:16px; }
.status-orb { width:9px; height:9px; border-radius:50%; background:#b4c0d0; box-shadow:0 0 0 5px #edf1f6; }
.runtime-list { display:grid; gap:0; margin:0; }
.runtime-list>div { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:47px; border-bottom:1px solid #edf0f5; }
.runtime-list dt { color:#78869b; font-size:13px; }
.runtime-list dd { margin:0; color:#34445f; font-size:13px; font-weight:650; text-align:right; overflow-wrap:anywhere; }
.gates { display:flex; flex-wrap:wrap; gap:7px; margin-top:17px; }
.gates span { padding:6px 9px; border-radius:999px; color:#8995a7; background:#f2f4f7; font-size:12px; }
.gates span.on { color:#35856a; background:#e9f7f1; }
.hint { margin:16px 0 0; color:#78869b; font-size:13px; line-height:1.7; }
.settings-form { padding-top:3px; }
.settings-form :deep(.el-form-item) { margin-bottom:11px; }
.full-width { width:100%; }
.inline-hint { margin-left:10px; color:#78869b; font-size:13px; line-height:1.55; }
.form-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-top:7px; color:#78869b; font-size:12px; }
.rules-card { margin-top:18px; }
.rules-heading { align-items:flex-start; }
.rules-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
.rules-subtitle { margin:7px 0 0; color:#78869b; font-size:13px; line-height:1.65; }
.rules-alert { margin-bottom:12px; }
.rules-editor-hint { margin:0; color:#78869b; font-size:13px; line-height:1.7; }
.rule-detail-meta { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:13px; }
.rule-detail-meta code { color:#8290a3; font-size:12px; overflow-wrap:anywhere; }
.rule-detail pre { max-height:55vh; overflow:auto; margin:0; padding:16px; border:1px solid #e6ebf3; border-radius:12px; background:#f7f9fc; color:#34445f; font-family:inherit; font-size:13px; line-height:1.75; white-space:pre-wrap; overflow-wrap:anywhere; }
.audit-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; color:#78869b; font-size:13px; }
@media(max-width:900px) { .grid { grid-template-columns:1fr; } }
@media(max-width:540px) { .page-heading { align-items:flex-start; } .card { padding:17px; } .form-footer { align-items:flex-start; flex-direction:column; } }
</style>
