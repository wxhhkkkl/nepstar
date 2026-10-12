import api from "@/api/client";

export interface AiConsultAdminSettings {
  configured: boolean;
  id: number;
  enabled: boolean;
  provider_code: string;
  model_code: string;
  maintenance_text: string;
  notice_version: string;
  notice_text: string;
  data_scope_text: string;
  guest_create_limit_per_minute: number;
  daily_success_limit: number;
  per_minute_limit: number;
  global_daily_token_limit: number;
  max_concurrent_generations: number;
  max_question_chars: number;
  active_rule_version_id: number | null;
  row_version: number;
  updated_at: string | null;
}

export interface AiConsultRuntimeStatus {
  provider_code: string;
  model_code: string | null;
  provider_secret_configured: boolean;
  provider_matches_settings: boolean;
  feature_gates: {
    guest: boolean;
    sessions: boolean;
    answers: boolean;
    operations: boolean;
  };
  can_enable: boolean;
  service_available?: boolean;
  activation_block_reason: string;
}

export interface AiConsultAdminConfig {
  settings: AiConsultAdminSettings;
  runtime: AiConsultRuntimeStatus;
}

export interface AiConsultOperations {
  day_utc: string;
  generated_at: string;
  running: number;
  stale_running: number;
  stale_after_seconds: number;
  oldest_stale_seconds: number | null;
  today_attempts: number;
  today_sessions: number;
  today_questions: number;
  today_completed: number;
  today_failed: number;
  completion_rate_percent: number | null;
  average_first_answer_seconds: number | null;
  today_charged_tokens: number;
  today_helpful_feedback: number;
  today_unhelpful_feedback: number;
  today_failure_reasons: Array<{ category: string; count: number }>;
}

export interface AiConsultRuleVersion {
  id: number;
  version: string;
  status: "draft" | "published" | "retired";
  active: boolean;
  content_hash: string;
  created_by: number;
  created_at: string;
  published_by: number | null;
  published_at: string | null;
}

export interface AiConsultRulePage {
  rules: AiConsultRuleVersion[];
  active_rule_version_id: number | null;
  limit: number;
  offset: number;
}

export interface AiConsultRuleDetail extends AiConsultRuleVersion {
  content: string;
}

export interface AiConsultAuditEntry {
  id: number;
  actor_admin_id: number;
  action:
    | "settings.update"
    | "service.pause"
    | "service.resume"
    | "rule.draft_create"
    | "rule.publish"
    | "rule.activate"
    | "unknown";
  target_id: string | null;
  change_summary: {
    changed_fields?: string[];
    from_row_version?: number;
    to_row_version?: number;
    from_rule_version_id?: number;
    to_rule_version_id?: number;
    version?: string;
    content_hash?: string;
    content_length?: number;
  };
  occurred_at: string;
}

export interface AiConsultAuditPage {
  entries: AiConsultAuditEntry[];
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface AiConsultAdminConfigInput {
  expected_row_version: number;
  enabled: boolean;
  provider_code: string;
  model_code: string;
  maintenance_text: string;
  notice_version: string;
  notice_text: string;
  data_scope_text: string;
  guest_create_limit_per_minute: number;
  daily_success_limit: number;
  per_minute_limit: number;
  global_daily_token_limit: number;
  max_concurrent_generations: number;
  max_question_chars: number;
}

export async function fetchAiConsultAdminSettings() {
  return api.get<unknown, { data: AiConsultAdminConfig }>(
    "/ai-consult/admin/settings",
  );
}

export async function updateAiConsultServiceState(input: { enabled: boolean; expected_row_version: number }) {
  return api.put<unknown, { data: AiConsultAdminConfig }>("/ai-consult/admin/service-state", input);
}

export async function fetchAiConsultAdminOperations() {
  return api.get<unknown, { data: AiConsultOperations }>(
    "/ai-consult/admin/operations",
  );
}

export interface AiConsultTokenUsage {
  input_tokens: number;
  output_tokens: number;
  actual_tokens: number;
  reserved_tokens: number;
  unreported_attempts: number;
}

export interface AiConsultTokenPoint {
  label: string;
  input_tokens: number | null;
  output_tokens: number | null;
  actual_tokens: number | null;
  reserved_tokens: number | null;
  unreported_attempts: number | null;
  future: boolean;
}

export interface AiConsultDashboard {
  timezone: string;
  day: string;
  month: string;
  generated_at: string;
  day_sessions: number;
  day_completed: number;
  day_failed: number;
  completion_rate_percent: number | null;
  running: number;
  stale_running: number;
  day_usage: AiConsultTokenUsage;
  month_usage: AiConsultTokenUsage;
  hourly_trend: AiConsultTokenPoint[];
  daily_trend: AiConsultTokenPoint[];
}

export interface AiConsultSessionRow {
  id: string;
  report_code: string;
  customer_id: number;
  report_date: string;
  source: string;
  source_indicator_code: string | null;
  source_plan_id: number | null;
  state: "empty" | "active" | "ended";
  created_at: string;
  last_activity_at: string;
  turn_count: number;
  usage: AiConsultTokenUsage;
}

export interface AiConsultSessionQuery {
  report_code?: string;
  customer_id?: number;
  start_date?: string;
  end_date?: string;
  state?: string;
  page?: number;
  page_size?: number;
}

export interface AiConsultSessionPage {
  records: AiConsultSessionRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface AiConsultAdminTurn {
  id: number;
  sequence: number;
  question: string;
  answer: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  feedback: string | null;
  evidence: Array<{ label: string; kind: string }>;
  attempts: Array<{
    attempt_number: number;
    status: string;
    model_code: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    actual_tokens: number | null;
    reserved_tokens: number;
    error_category: string | null;
    started_at: string | null;
    finished_at: string | null;
  }>;
}

export interface AiConsultSessionDetail {
  session: AiConsultSessionRow;
  turns: AiConsultAdminTurn[];
  limit: number;
  offset: number;
  has_more: boolean;
}

export async function fetchAiConsultDashboard(
  params: { day?: string; month?: string } = {},
) {
  return api.get<unknown, { data: AiConsultDashboard }>(
    "/ai-consult/admin/dashboard",
    { params },
  );
}

export async function fetchAiConsultSessions(
  params: AiConsultSessionQuery = {},
) {
  return api.get<unknown, { data: AiConsultSessionPage }>(
    "/ai-consult/admin/sessions",
    { params },
  );
}

export async function fetchAiConsultSessionDetail(
  id: string,
  params: { limit?: number; offset?: number } = {},
) {
  return api.get<unknown, { data: AiConsultSessionDetail }>(
    `/ai-consult/admin/sessions/${encodeURIComponent(id)}`,
    { params },
  );
}

export async function updateAiConsultAdminSettings(
  payload: AiConsultAdminConfigInput,
) {
  return api.put<unknown, { data: AiConsultAdminConfig }>(
    "/ai-consult/admin/settings",
    payload,
  );
}

export async function fetchAiConsultRuleVersions(
  params: { limit?: number; offset?: number } = {},
) {
  return api.get<unknown, { data: AiConsultRulePage }>(
    "/ai-consult/admin/rules",
    { params },
  );
}

export async function fetchAiConsultRuleVersion(id: number) {
  return api.get<unknown, { data: AiConsultRuleDetail }>(
    `/ai-consult/admin/rules/${id}`,
  );
}

export async function fetchAiConsultAdminAudit(
  params: { limit?: number; offset?: number } = {},
) {
  return api.get<unknown, { data: AiConsultAuditPage }>(
    "/ai-consult/admin/audit",
    { params },
  );
}

export async function createAiConsultRuleDraft(payload: {
  version: string;
  content: string;
}) {
  return api.post<unknown, { data: AiConsultRuleVersion }>(
    "/ai-consult/admin/rules",
    payload,
  );
}

export async function publishAiConsultRuleVersion(
  id: number,
  expectedRowVersion: number,
) {
  return api.post<
    unknown,
    {
      data: {
        rule: AiConsultRuleVersion;
        active_rule_version_id: number;
        row_version: number;
      };
    }
  >(`/ai-consult/admin/rules/${id}/publish`, {
    expected_row_version: expectedRowVersion,
  });
}

export async function activateAiConsultRuleVersion(
  id: number,
  expectedRowVersion: number,
) {
  return api.post<
    unknown,
    {
      data: {
        rule: AiConsultRuleVersion;
        active_rule_version_id: number;
        row_version: number;
      };
    }
  >(`/ai-consult/admin/rules/${id}/activate`, {
    expected_row_version: expectedRowVersion,
  });
}
