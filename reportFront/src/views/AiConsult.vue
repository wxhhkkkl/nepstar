<script setup>
import {
  computed,
  inject,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue";
import { onBeforeRouteLeave, routerKey } from "vue-router";
import {
  AiConsultApiError,
  createConsultSession,
  endConsultSession,
  loadConsultBootstrap,
  loadConsultTurn,
  streamConsultQuestion,
  streamConsultRetry,
  stopConsultGeneration,
  submitConsultFeedback,
} from "@/api/aiConsultClient.js";
import {
  reportParamsFromLocation,
  reportRouteQueryFromLocation,
} from "@/api/reportClient.js";
import AiConsultWelcomeSkeleton from "@/components/AiConsultWelcomeSkeleton.vue";
import AiConsultReportCard from "@/components/AiConsultReportCard.vue";
import AiConsultAnswer from "@/components/AiConsultAnswer.vue";
import avatar from "@/assets/ai-longevity-doctor-avatar.png";
import { resolveProductImageUrl } from "@/data/reportAdapter.js";
import { createUuid } from "@/utils/uuid.js";
import { scoreAppearance, scoreStyle } from "@/utils/scoreColor.js";

defineOptions({ name: "AiConsult" });

const reportQuery = ref(reportRouteQueryFromLocation());
const backTo = computed(() => {
  const query = { ...reportQuery.value };
  const returnSystem = query.returnSystem;
  delete query.returnSystem;
  delete query.planId;
  delete query.indicatorCode;
  if (returnSystem && /^SYS_[A-Z0-9_]+$/.test(String(returnSystem))) {
    return {
      name: "system-detail",
      params: { systemId: String(returnSystem) },
      query,
    };
  }
  delete query.fromAiConsult;
  return query.reportId ? { name: "home", query } : { name: "home" };
});
const state = ref("loading");
const errorKind = ref("");
const maintenanceText = ref("");
const welcome = ref(null);
const entryContext = ref(null);
const reportScore = computed(() =>
  Number.isFinite(welcome.value?.report_score) &&
  welcome.value.report_score >= 0 &&
  welcome.value.report_score <= 100
    ? welcome.value.report_score
    : null,
);
const focusSystems = computed(() => welcome.value?.focus_systems || []);
const managementPlans = computed(() => welcome.value?.management_plans || []);
const plansExpanded = ref(false);
const visibleManagementPlans = computed(() =>
  plansExpanded.value ? managementPlans.value : managementPlans.value.slice(0, 1),
);

const failedPlanImages = ref(new Set());
const messages = ref([]);
const questionText = ref("");
const questionInput = ref(null);
const composerExtraHeight = ref(0);

function resizeQuestionInput() {
  const input = questionInput.value;
  if (!input) {
    composerExtraHeight.value = 0;
    return;
  }
  const style = window.getComputedStyle(input);
  const minHeight = parseFloat(style.minHeight) || 46;
  const maxHeight = parseFloat(style.maxHeight) || 126;
  input.style.overflowY = 'hidden';
  input.style.height = 'auto';
  const height = Math.max(minHeight, Math.min(input.scrollHeight, maxHeight));
  input.style.height = `${height}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  composerExtraHeight.value = height - minHeight;
}

watch([questionText, questionInput], resizeQuestionInput, { flush: 'post' });
const sending = ref(false);
const stopBusy = ref(false);
const chatError = ref("");
const admissionFailure = ref("");
const cooldownKind = ref("");
const cooldownSeconds = ref(0);
let cooldownTimer = null;
const currentSessionId = ref(null);
const newReplyPending = ref(false);
const showBackToTop = ref(false);
const feedbackReasonFor = ref(null);
let savedScrollY = 0;
let activeIdentity = "";
let activeController = null;
let activeMessage = null;
let followLatest = true;
let scrollListening = false;
let startFreshOnActivation = false;
const sessionEnded = ref(false);
const leaveConfirmOpen = ref(false);
const leaveDialog = ref(null);
const continueButton = ref(null);
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
let idleTimer = null;
let idleDeadline = 0;
let sessionScope = null;
let lifecycleListening = false;
let resolveLeave = null;
let leaveDecision = null;
let leaveApproved = false;
let previousFocus = null;

function clearIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = null;
}

async function endCurrentSession(keepalive = false) {
  sessionEnded.value = true;
  clearIdleTimer();
  if (activeMessage?.status === "loading") {
    activeMessage.status = "stopped";
    activeMessage.answer = "";
    activeMessage.evidence = [];
    activeMessage.retryable = false;
  }
  const controller = activeController;
  const id = currentSessionId.value;
  const scope = sessionScope;
  if (!id || !scope) {
    controller?.abort();
    return;
  }
  try {
    await endConsultSession(scope.reportCode, scope.customerId, id, { keepalive });
  } catch {
    // The server also enforces the ten-minute deadline if the exit signal is lost.
  } finally {
    controller?.abort();
  }
}

function checkIdleDeadline() {
  if (!sessionEnded.value && idleDeadline && Date.now() >= idleDeadline) {
    void endCurrentSession();
    return true;
  }
  return sessionEnded.value;
}

function resetIdleTimer() {
  if (sessionEnded.value) return;
  clearIdleTimer();
  idleDeadline = Date.now() + IDLE_TIMEOUT_MS;
  idleTimer = setTimeout(checkIdleDeadline, IDLE_TIMEOUT_MS);
}

function finishLeaveDecision(confirmed) {
  leaveConfirmOpen.value = false;
  resolveLeave?.(confirmed);
  resolveLeave = null;
  leaveDecision = null;
  if (!confirmed) previousFocus?.focus?.();
}

function leaveDialogKeys(event) {
  if (event.key === "Escape") finishLeaveDecision(false);
  if (event.key === "Tab") {
    const buttons = leaveDialog.value?.querySelectorAll("button");
    if (!buttons?.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
}

async function confirmPageLeave() {
  if (sessionEnded.value || (!messages.value.length && !questionText.value.trim())) return true;
  if (!leaveDecision) {
    previousFocus = document.activeElement;
    leaveConfirmOpen.value = true;
    leaveDecision = new Promise((resolve) => { resolveLeave = resolve; });
    nextTick(() => continueButton.value?.focus());
  }
  if (!(await leaveDecision)) return false;
  leaveApproved = true;
  await endCurrentSession();
  return true;
}

if (inject(routerKey, null)) onBeforeRouteLeave(confirmPageLeave);

function beforePageUnload(event) {
  if (!leaveApproved && !sessionEnded.value && (currentSessionId.value || questionText.value.trim())) {
    event.preventDefault();
    event.returnValue = "";
  }
}

function onPageHide() { void endCurrentSession(true); }

function bindLifecycle() {
  if (lifecycleListening) return;
  lifecycleListening = true;
  window.addEventListener("beforeunload", beforePageUnload);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("focus", checkIdleDeadline);
}

function unbindLifecycle() {
  lifecycleListening = false;
  window.removeEventListener("beforeunload", beforePageUnload);
  window.removeEventListener("pagehide", onPageHide);
  window.removeEventListener("focus", checkIdleDeadline);
  clearIdleTimer();
}

const serviceAvailable = computed(
  () => welcome.value?.service_status === "available",
);
const canAsk = computed(() => serviceAvailable.value);
const admissionReason = computed(() =>
  sessionEnded.value ? "session_ended" : welcome.value?.remaining_today === 0
    ? "daily_limit"
    : admissionFailure.value ||
      (cooldownSeconds.value > 0 ? cooldownKind.value : "") ||
      (messages.value.some((message) => message.status === "timed_out")
        ? "in_progress"
        : ""),
);
const canSend = computed(() => canAsk.value && !admissionReason.value);
const admissionText = computed(() => {
  if (admissionReason.value === "session_ended")
    return "本次会话已结束。你可以开始新的咨询。";
  if (admissionReason.value === "daily_limit")
    return "今天的咨询次数已用完，当前对话仍可阅读。请明天再试。";
  if (admissionReason.value === "global_budget_exhausted")
    return "今日咨询额度已用完，当前对话仍可阅读。请明天再试。";
  if (admissionReason.value === "in_progress")
    return "上一条回答尚未确认结束，请先查询回答状态。当前输入已保留。";
  if (admissionReason.value === "processing_withdrawn")
    return "当前咨询已停止使用报告数据，不能继续发送问题。";
  if (admissionReason.value === "service_paused")
    return "AI 咨询服务已暂停，暂时不能发送或重试。当前对话仍可阅读，请稍后重新进入。";
  const reason =
    admissionReason.value === "capacity_busy"
      ? "当前咨询人数较多"
      : "提问较频繁";
  return `${reason}，请在 ${cooldownSeconds.value} 秒后重试。原问题已保留。`;
});

function clearCooldown() {
  clearTimeout(cooldownTimer);
  cooldownTimer = null;
  cooldownKind.value = "";
  cooldownSeconds.value = 0;
}

function applyAdmissionError(error) {
  if (error?.kind === "session_not_found") {
    void endCurrentSession();
  } else if (["disabled", "consult.disabled"].includes(error?.kind)) {
    admissionFailure.value = "service_paused";
  } else if (["processing_withdrawn", "consult.access_changed"].includes(error?.kind)) {
    admissionFailure.value = "processing_withdrawn";
  } else if (error?.kind === "daily_limit") {
    if (welcome.value) welcome.value.remaining_today = 0;
  } else if (error?.kind === "global_budget_exhausted") {
    admissionFailure.value = error.kind;
  } else if (["rate_limited", "capacity_busy"].includes(error?.kind)) {
    clearCooldown();
    cooldownKind.value = error.kind;
    const provided = error.retryAfterSeconds;
    const seconds =
      Number.isSafeInteger(provided) && provided >= 1 && provided <= 86400
        ? provided
        : error.kind === "rate_limited"
          ? 60
          : 5;
    const until = Date.now() + seconds * 1000;
    const tick = () => {
      cooldownSeconds.value = Math.max(
        0,
        Math.ceil((until - Date.now()) / 1000),
      );
      if (cooldownSeconds.value) cooldownTimer = setTimeout(tick, 1000);
      else clearCooldown();
    };
    tick();
  }
}

function updateRemainingAnswers(data) {
  if (
    (data.remaining_today === null ||
      (Number.isSafeInteger(data.remaining_today) && data.remaining_today >= 0)) &&
    welcome.value
  ) {
    welcome.value.remaining_today = data.remaining_today;
  }
}
const questionLimit = computed(() => {
  const limit = welcome.value?.max_question_chars;
  return Number.isSafeInteger(limit) && limit >= 0 && limit <= 500
    ? limit
    : 500;
});

function applyMaintenance(error) {
  if (error?.kind !== "maintenance") return false;
  maintenanceText.value =
    typeof error.detail === "string" ? error.detail.slice(0, 500) : "";
  if (welcome.value) {
    welcome.value.service_status = "maintenance";
    welcome.value.maintenance_text = maintenanceText.value;
  }
  return true;
}

function identity() {
  const { reportCode, customerId } = reportParamsFromLocation();
  return `${reportCode}:${customerId}`;
}

function requestedEntry() {
  const query = reportRouteQueryFromLocation();
  const planId = Number(query.planId);
  const indicatorCode = String(query.indicatorCode || "");
  return {
    planId: Number.isSafeInteger(planId) && planId > 0 ? planId : null,
    indicatorCode: /^[A-Z][A-Z0-9_]{1,63}$/.test(indicatorCode)
      ? indicatorCode
      : null,
  };
}

function entryPrompt(context) {
  if (!context || !context.indicator_name) return "";
  if (context.type === "plan")
    return `为什么会为我推荐「${context.plan_name}」？`;
  return `我想了解「${context.indicator_name}」这个指标的结果。`;
}

function applyEntryContext(data) {
  entryContext.value = data?.entry_context || null;
  const prompt = entryPrompt(entryContext.value);
  if (prompt) {
    const remaining = (data.suggested_questions || []).filter(
      (item) => item !== prompt,
    );
    data.suggested_questions = [prompt, ...remaining].slice(0, 3);
  }
  questionText.value = prompt;
}

function safeTurnId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function followUpSuggestions(message) {
  if (
    message.status !== "completed" ||
    !Array.isArray(message.evidence) ||
    messages.value.at(-1) !== message
  )
    return [];
  const asked = new Set(
    messages.value
      .map((item) => normalizeFollowUpQuestion(item.question))
      .filter(Boolean),
  );
  const offered = message.evidence
    .filter(
      (item) =>
        item?.kind === "report" && Array.isArray(item.follow_up_questions),
    )
    .flatMap((item) => item.follow_up_questions)
    .filter((question) => typeof question === "string");
  return [
    ...new Map(
      offered
        .map((question) => [normalizeFollowUpQuestion(question), question])
        .filter(([key]) => key && !asked.has(key)),
    ).values(),
  ].slice(0, 2);
}

function normalizeFollowUpQuestion(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s？?。.!！,，、;；:：]+/g, "");
}

function maintainedActions(message) {
  if (message.status !== "completed" || !Array.isArray(message.evidence))
    return [];
  return message.evidence.filter(
    (item) =>
      item?.source_type === "action" &&
      typeof item.text === "string" &&
      item.text.trim(),
  );
}

function messageTime(value) {
  return value ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value) : '';
}

async function load() {
  const { reportCode, customerId } = reportParamsFromLocation();
  reportQuery.value = reportRouteQueryFromLocation();
  if (!reportCode || customerId === null) {
    errorKind.value = "report_unavailable";
    state.value = "error";
    return;
  }
  state.value = "loading";
  plansExpanded.value = false;
  maintenanceText.value = "";
  feedbackReasonFor.value = null;
  messages.value = [];
  newReplyPending.value = false;
  followLatest = true;
  currentSessionId.value = null;
  sessionEnded.value = false;
  sessionScope = null;
  idleDeadline = 0;
  clearIdleTimer();
  leaveApproved = false;
  chatError.value = "";
  clearCooldown();
  admissionFailure.value = "";
  const requestedIdentity = identity();
  activeIdentity = requestedIdentity;
  try {
    const data = await loadConsultBootstrap(
      reportCode,
      customerId,
      requestedEntry(),
    );
    if (activeIdentity !== requestedIdentity) return;
    if (
      !data ||
      !Array.isArray(data.suggested_questions) ||
      typeof data.report_summary !== "string"
    ) {
      throw new AiConsultApiError("unavailable");
    }
    welcome.value = data;
    applyEntryContext(data);
    maintenanceText.value =
      typeof data.maintenance_text === "string"
        ? data.maintenance_text.slice(0, 500)
        : "";
    state.value = "ready";
    onPageScroll();
  } catch (error) {
    if (activeIdentity !== requestedIdentity) return;
    errorKind.value =
      error instanceof AiConsultApiError ? error.kind : "network";
    maintenanceText.value =
      errorKind.value === "maintenance" ? error.detail : "";
    state.value = "error";
  }
}

function nearPageBottom() {
  const height = Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight || 0,
  );
  return height - (window.scrollY + window.innerHeight) <= 120;
}

function onPageScroll() {
  showBackToTop.value = window.scrollY > 360;
  if (state.value !== "ready" || !messages.value.length) return;
  followLatest = nearPageBottom();
  if (followLatest) newReplyPending.value = false;
}

function scrollToPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

function bindPageScroll() {
  if (scrollListening) return;
  window.addEventListener("scroll", onPageScroll, { passive: true });
  window.addEventListener("resize", resizeQuestionInput);
  void nextTick(resizeQuestionInput);
  scrollListening = true;
}

function unbindPageScroll() {
  if (!scrollListening) return;
  window.removeEventListener("scroll", onPageScroll);
  window.removeEventListener("resize", resizeQuestionInput);
  scrollListening = false;
}

function rememberChatPosition() {
  savedScrollY = Math.max(0, Number(window.scrollY) || 0);
}

async function restoreChatPosition() {
  if (!savedScrollY) return;
  await nextTick();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY, left: 0, behavior: "auto" });
    }),
  );
}

async function scrollToLatest({ force = false, announce = false } = {}) {
  if (force) {
    followLatest = true;
    newReplyPending.value = false;
  } else if (!followLatest) {
    if (announce) newReplyPending.value = true;
    return;
  }
  await nextTick();
  if (!followLatest && !force) {
    if (announce) newReplyPending.value = true;
    return;
  }
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    left: 0,
    behavior: "auto",
  });
}

function revealValidatedAnswer(message, text, signal) {
  const characters = Array.from(typeof text === "string" ? text : "");
  if (!characters.length || signal.aborted || sessionEnded.value) return Promise.resolve();

  const chunkSize = Math.max(2, Math.ceil(characters.length / 80));
  const interval = Math.max(
    16,
    Math.min(32, 1800 / Math.ceil(characters.length / chunkSize)),
  );

  return new Promise((resolve) => {
    let index = 0;
    let timer = null;
    const finish = () => {
      if (timer !== null) clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const appendNextChunk = () => {
      if (signal.aborted || sessionEnded.value || message.status === "stopped") {
        finish();
        return;
      }

      const nextIndex = Math.min(index + chunkSize, characters.length);
      message.answer += characters.slice(index, nextIndex).join("");
      index = nextIndex;
      if (index % (chunkSize * 4) === 0 || index === characters.length) {
        void scrollToLatest({ announce: true });
      }

      if (index === characters.length) finish();
      else timer = setTimeout(appendNextChunk, interval);
    };

    signal.addEventListener("abort", finish, { once: true });
    appendNextChunk();
  });
}

function chatErrorText(error) {
  if (["disabled", "consult.disabled"].includes(error?.kind))
    return "AI 咨询服务已暂停，本次回答未完成。当前对话仍可阅读，请稍后重新进入。";
  if (["processing_withdrawn", "consult.access_changed"].includes(error?.kind))
    return "当前咨询已停止使用报告数据，本次回答不会展示。";
  if (error?.kind === "maintenance")
    return error.detail || "咨询服务正在维护，请稍后再试。";
  if (error?.kind === "entry_unavailable")
    return "方案或指标信息已变化，请刷新页面后再试。";
  if (error?.kind === "timeout")
    return "等待时间较长，正在核对服务端的回答状态。";
  if (error?.kind === "consult.urgent_help" && error.detail)
    return error.detail;
  if (error?.kind === "consult.clinical_boundary")
    return "我不能根据这份报告为你确诊、开处方或决定调整药物。请联系医生或药师。";
  if (error?.kind === "consult.longevity_boundary")
    return "这份报告不能预测寿命或保证延寿；我们可以继续讨论可核对的指标和日常健康管理。";
  if (error?.kind === "consult.private_input")
    return "为保护隐私，请删除问题中的报告编号和联系方式后再试。";
  if (error?.kind === "in_progress")
    return "上一条问题仍在处理中，请稍后再试。";
  if (error?.kind === "generation_changed")
    return "这条回答的状态已变化，请刷新页面查看最新结果。";
  if (error?.kind === "daily_limit")
    return "今天的咨询次数已用完，请明天再试。";
  if (error?.kind === "global_budget_exhausted")
    return "今日咨询额度已用完，请明天再试。";
  if (error?.kind === "capacity_busy") return "当前咨询人数较多，请稍后重试。";
  if (error?.kind === "rate_limited")
    return "提问太频繁，请等待提示的时间后重试。";
  if (error?.kind === "question_too_long") return "问题较长，请缩短后再发送。";
  if (error?.kind === "incomplete")
    return "连接中断，本次回答未完成。请稍后重新提问。";
  if (error?.kind === "network") return "网络连接失败，本次回答未完成。";
  if (error?.kind === "consult.insufficient_evidence")
    return "当前报告缺少可核对的依据，暂时无法回答这项问题。";
  return "本次回答未完成，请稍后重新提问。";
}

function terminalFailure(error) {
  return [
    "consult.failed",
    "consult.provider_unavailable",
    "consult.report_unavailable",
    "consult.insufficient_evidence",
    "consult.unsafe_answer",
    "consult.urgent_help",
    "consult.clinical_boundary",
    "consult.longevity_boundary",
    "consult.private_input",
  ].includes(error?.kind);
}

function retryableBeforeAccept(error) {
  return [
    "network",
    "incomplete",
    "timeout",
    "unavailable",
    "rate_limited",
    "capacity_busy",
    "in_progress",
  ].includes(error?.kind);
}

async function sendQuestion(rawQuestion, existingMessage = null) {
  if (checkIdleDeadline()) return;
  const question = existingMessage
    ? existingMessage.question
    : rawQuestion?.trim();
  if (!canSend.value || sending.value || !question) return;
  if (questionLimit.value > 0 && question.length > questionLimit.value) {
    chatError.value = `每次最多可输入 ${questionLimit.value} 字，请缩短后再发送。`;
    return;
  }
  const { reportCode, customerId } = reportParamsFromLocation();
  if (!reportCode || customerId === null) return;
  let message;
  let controller;
  try {
    message = existingMessage || reactive({
      id: createUuid(),
      turnId: null,
      generationId: null,
      question,
      createdAt: Date.now(),
      answer: "",
      evidence: [],
      status: "loading",
      feedback: null,
      feedbackReason: null,
      feedbackBusy: false,
      feedbackError: "",
      stopError: "",
      retryError: "",
      retryable: false,
      statusChecking: false,
    });
    controller = new AbortController();
  } catch (error) {
    chatError.value = chatErrorText(error);
    return;
  }
  sending.value = true;
  chatError.value = "";
  if (existingMessage) {
    message.status = "loading";
    message.answer = "";
    message.evidence = [];
    message.retryable = false;
    message.retryError = "";
  }
  activeController = controller;
  activeMessage = message;
  if (!existingMessage) {
    messages.value.push(message);
    questionText.value = "";
  }
  scrollToLatest({ force: true });
  try {
    if (!currentSessionId.value) {
      const createdId = await createConsultSession(
        reportCode,
        customerId,
        entryContext.value,
      );
      if (controller.signal.aborted) {
        await endConsultSession(reportCode, customerId, createdId, { keepalive: true });
        return;
      }
      currentSessionId.value = createdId;
      sessionScope = { reportCode, customerId };
      if (sessionEnded.value) {
        await endCurrentSession(true);
        return;
      }
      resetIdleTimer();
    }
    if (controller.signal.aborted) return;
    await streamConsultQuestion(
      reportCode,
      customerId,
      currentSessionId.value,
      question,
      {
        requestId: message.id,
        signal: controller.signal,
        async onEvent(event, data) {
          if (sessionEnded.value || controller.signal.aborted || message.status === "stopped") return;
          if (event === "accepted") {
            resetIdleTimer();
            message.turnId = safeTurnId(data.turn_id);
            message.generationId = safeTurnId(data.generation_id);
          }
          if (event === "delta")
            await revealValidatedAnswer(message, data.text || "", controller.signal);
          if (event === "evidence")
            message.evidence = Array.isArray(data.items) ? data.items : [];
          if (event === "completed") {
            message.answer = data.answer || message.answer;
            message.status = "completed";
            message.retryable = false;
            updateRemainingAnswers(data);
          }
          scrollToLatest({
            announce: event === "delta" || event === "completed",
          });
        },
      },
    );
  } catch (error) {
    if (sessionEnded.value) return;
    if (message.status !== "stopped") {
      if (
        message.turnId &&
        currentSessionId.value &&
        ["network", "incomplete", "timeout", "in_progress"].includes(
          error?.kind,
        )
      ) {
        try {
          const saved = await loadConsultTurn(
            reportCode,
            customerId,
            currentSessionId.value,
            message.turnId,
          );
          if (sessionEnded.value || controller.signal.aborted) return;
          if (
            saved.status === "completed" &&
            typeof saved.answer === "string" &&
            saved.answer &&
            saved.evidence.length
          ) {
            message.answer = saved.answer;
            message.evidence = saved.evidence;
            message.status = "completed";
            message.feedback = saved.feedback_value || null;
            message.retryable = false;
            scrollToLatest({ announce: true });
            return;
          }
          message.generationId =
            safeTurnId(saved.generation_id) || message.generationId;
          if (saved.can_retry === true && message.generationId) {
            message.status =
              saved.status === "stopped" ? "stopped" : "incomplete";
            message.retryable = true;
            chatError.value = chatErrorText(error);
            scrollToLatest({ announce: true });
            return;
          }
          // Public turn responses redact all unfinished generations as
          // incomplete; can_retry=false means keep querying, not regenerate.
          if (saved.status === "incomplete" && saved.can_retry === false) {
            message.status = "timed_out";
            message.retryable = false;
            message.retryError = "回答仍在生成中，稍后可再次查询。";
            chatError.value = "";
            scrollToLatest({ announce: true });
            return;
          }
          if (error.kind === "timeout") {
            message.status = "timed_out";
            message.retryable = false;
            chatError.value = chatErrorText(error);
            scrollToLatest({ announce: true });
            return;
          }
        } catch {
          /* 服务端尚未完成或仍不可访问；保留未完成状态。 */
        }
      }
      if (sessionEnded.value || controller.signal.aborted) return;
      message.status =
        error?.kind === "timeout" && message.turnId
          ? "timed_out"
          : "incomplete";
      message.answer = "";
      message.evidence = [];
      message.retryable = message.turnId
        ? Boolean(message.generationId && terminalFailure(error))
        : retryableBeforeAccept(error);
      applyMaintenance(error);
      applyAdmissionError(error);
      chatError.value =
        error?.kind === "timeout" && !message.turnId
          ? "请求等待超时，请稍后重试。"
          : chatErrorText(error);
      scrollToLatest({ announce: true });
    }
  } finally {
    if (activeMessage === message && activeController === controller) {
      sending.value = false;
      activeMessage = null;
      activeController = null;
    }
  }
}

async function checkTimedOutTurn(message) {
  if (checkIdleDeadline()) return;
  if (
    message.status !== "timed_out" ||
    message.statusChecking ||
    !message.turnId ||
    !currentSessionId.value
  )
    return;
  const { reportCode, customerId } = reportParamsFromLocation();
  if (!reportCode || customerId === null) return;
  message.statusChecking = true;
  message.retryError = "";
  try {
    const saved = await loadConsultTurn(
      reportCode,
      customerId,
      currentSessionId.value,
      message.turnId,
    );
    if (sessionEnded.value) return;
    message.generationId =
      safeTurnId(saved.generation_id) || message.generationId;
    if (
      saved.status === "completed" &&
      typeof saved.answer === "string" &&
      saved.answer &&
      saved.evidence.length
    ) {
      message.answer = saved.answer;
      message.evidence = saved.evidence;
      message.status = "completed";
      message.feedback = saved.feedback_value || null;
      message.retryable = false;
      chatError.value = "";
    } else if (saved.can_retry === true && message.generationId) {
      message.answer = "";
      message.evidence = [];
      message.status = saved.status === "stopped" ? "stopped" : "incomplete";
      message.retryable = true;
      message.retryError = "服务端已结束本次尝试，可以重新生成。";
      chatError.value = "";
    } else {
      message.status = "timed_out";
      message.retryable = false;
      message.retryError = "服务端仍未确认完成，请稍后再次查询。";
    }
  } catch {
    if (!sessionEnded.value) message.retryError = "暂时无法查询回答状态，请检查网络后重试。";
  } finally {
    message.statusChecking = false;
    if (!sessionEnded.value) scrollToLatest({ announce: true });
  }
}

async function stopCurrent(message) {
  if (
    activeMessage !== message ||
    !activeController ||
    !currentSessionId.value ||
    !message.turnId ||
    !message.generationId ||
    message.status !== "loading" ||
    stopBusy.value
  )
    return;
  const { reportCode, customerId } = reportParamsFromLocation();
  if (!reportCode || customerId === null) return;
  stopBusy.value = true;
  message.stopError = "";
  const controller = activeController;
  try {
    await stopConsultGeneration(
      reportCode,
      customerId,
      currentSessionId.value,
      message.turnId,
      message.generationId,
    );
    if (sessionEnded.value) return;
    message.status = "stopped";
    message.answer = "";
    message.evidence = [];
    message.retryable = true;
    scrollToLatest({ announce: true });
    controller.abort();
  } catch {
    message.stopError = "暂时无法停止，请稍后重试或刷新查看状态。";
  } finally {
    stopBusy.value = false;
  }
}

async function retryCurrent(message) {
  if (checkIdleDeadline()) return;
  if (
    !canSend.value ||
    sending.value ||
    !message.retryable ||
    !currentSessionId.value ||
    !message.turnId ||
    !message.generationId
  )
    return;
  const { reportCode, customerId } = reportParamsFromLocation();
  if (!reportCode || customerId === null) return;
  const previousStatus = message.status;
  const expectedGenerationId = message.generationId;
  const controller = new AbortController();
  activeController = controller;
  activeMessage = message;
  sending.value = true;
  chatError.value = "";
  message.retryable = false;
  message.retryError = "";
  message.status = "loading";
  message.answer = "";
  message.evidence = [];
  scrollToLatest({ force: true });
  let accepted = false;
  try {
    await streamConsultRetry(
      reportCode,
      customerId,
      currentSessionId.value,
      message.turnId,
      expectedGenerationId,
      {
        signal: controller.signal,
        async onEvent(event, data) {
          if (sessionEnded.value || controller.signal.aborted || message.status === "stopped") return;
          if (event === "accepted") {
            resetIdleTimer();
            accepted = true;
            message.turnId = safeTurnId(data.turn_id);
            message.generationId = safeTurnId(data.generation_id);
          }
          if (event === "delta")
            await revealValidatedAnswer(message, data.text || "", controller.signal);
          if (event === "evidence")
            message.evidence = Array.isArray(data.items) ? data.items : [];
          if (event === "completed") {
            message.answer = data.answer || message.answer;
            message.status = "completed";
            updateRemainingAnswers(data);
          }
          scrollToLatest({
            announce: event === "delta" || event === "completed",
          });
        },
      },
    );
  } catch (error) {
    if (sessionEnded.value) return;
    if (message.status !== "stopped") {
      applyMaintenance(error);
      applyAdmissionError(error);
      let recovered = false;
      if (
        error?.kind === "timeout" &&
        message.turnId &&
        currentSessionId.value
      ) {
        try {
          const saved = await loadConsultTurn(
            reportCode,
            customerId,
            currentSessionId.value,
            message.turnId,
          );
          if (sessionEnded.value || controller.signal.aborted) return;
          message.generationId =
            safeTurnId(saved.generation_id) ||
            message.generationId ||
            expectedGenerationId;
          if (
            saved.status === "completed" &&
            typeof saved.answer === "string" &&
            saved.answer &&
            saved.evidence.length
          ) {
            message.answer = saved.answer;
            message.evidence = saved.evidence;
            message.status = "completed";
            message.feedback = saved.feedback_value || null;
            message.retryable = false;
            recovered = true;
          } else if (saved.can_retry === true && message.generationId) {
            message.status =
              saved.status === "stopped" ? "stopped" : "incomplete";
            message.retryable = true;
            message.retryError = "服务端已结束本次尝试，可以重新生成。";
            recovered = true;
          } else {
            message.status = "timed_out";
            message.retryable = false;
            recovered = true;
          }
        } catch {
          /* 保留问题和查询入口，用户可稍后再次核实。 */
        }
      }
      if (sessionEnded.value || controller.signal.aborted) return;
      if (!recovered) {
        message.status =
          error?.kind === "timeout"
            ? "timed_out"
            : accepted
              ? "incomplete"
              : previousStatus;
        message.generationId = accepted
          ? message.generationId
          : expectedGenerationId;
      }
      if (message.status !== "completed") {
        message.answer = "";
        message.evidence = [];
      }
      if (!recovered) {
        message.retryable =
          (!accepted && error?.kind !== "generation_changed") ||
          terminalFailure(error);
        message.retryError = chatErrorText(error);
      } else if (message.status === "completed") {
        message.retryError = "";
        chatError.value = "";
      } else if (message.status === "timed_out") {
        message.retryError = chatErrorText(error);
      }
      scrollToLatest({ announce: true });
    }
  } finally {
    if (activeMessage === message && activeController === controller) {
      sending.value = false;
      activeMessage = null;
      activeController = null;
    }
  }
}

async function rateAnswer(message, helpful, reason = null) {
  if (
    message.status !== "completed" ||
    !message.turnId ||
    !currentSessionId.value ||
    message.feedbackBusy
  )
    return;
  const { reportCode, customerId } = reportParamsFromLocation();
  if (!reportCode || customerId === null) return;
  message.feedbackBusy = true;
  message.feedbackError = "";
  try {
    const result = await submitConsultFeedback(
      reportCode,
      customerId,
      currentSessionId.value,
      message.turnId,
      helpful,
      reason,
    );
    message.feedback = result.feedback_value;
    message.feedbackReason = result.feedback_reason;
    feedbackReasonFor.value = null;
  } catch {
    message.feedbackError = "评价未保存，请重试。";
  } finally {
    message.feedbackBusy = false;
  }
}

function errorMessage(kind) {
  if (kind === "maintenance")
    return maintenanceText.value || "咨询服务正在维护，请稍后再试。";
  if (kind === "report_unavailable")
    return "报告链接无效或报告暂时不可用。请返回报告页核对。";
  if (kind === "disabled")
    return "咨询服务尚未开放，报告内容不会发送给 AI 服务商。";
  if (kind === "network") return "网络连接失败，请检查网络后重试。";
  if (kind === "timeout") return "请求等待超时，请稍后重试。";
  if (kind === "rate_limited") return "访问较频繁，请稍后再试。";
  return "咨询服务暂时不可用，请稍后再试。";
}

onMounted(() => {
  document.title = "AI 长寿咨询｜长寿指数";
  bindPageScroll();
  bindLifecycle();
  load();
});
onActivated(() => {
  bindPageScroll();
  bindLifecycle();
  if (
    startFreshOnActivation ||
    (activeIdentity && identity() !== activeIdentity)
  ) {
    startFreshOnActivation = false;
    savedScrollY = 0;
    load();
  } else {
    restoreChatPosition();
  }
});
onDeactivated(() => {
  unbindPageScroll();
  unbindLifecycle();
  if (!sessionEnded.value) void endCurrentSession(true);
  clearCooldown();
  if (activeIdentity) startFreshOnActivation = true;
});
onUnmounted(() => {
  unbindPageScroll();
  unbindLifecycle();
  if (!sessionEnded.value) void endCurrentSession(true);
  finishLeaveDecision(false);
  clearCooldown();
});
</script>

<template>
  <AiConsultWelcomeSkeleton v-if="state === 'loading'" />
  <main
    v-else
    class="app-shell ai-consult-page"
    :style="{ '--ai-composer-extra': `${composerExtraHeight}px` }"
    data-testid="ai-consult-welcome"
  >
    <header class="ai-topbar">
      <RouterLink :to="backTo" class="ai-back" aria-label="返回报告"
        ><svg viewBox="0 0 24 24"><path d="m14 5-7 7 7 7" /></svg
      ></RouterLink>
      <div class="ai-topbar-title">
        <strong>AI 长寿咨询</strong>
      </div>
      <span class="ai-topbar-space" aria-hidden="true" />
    </header>

    <section v-if="state === 'error'" class="ai-error" role="alert">
      <div class="ai-error-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" />
          <path d="M32 17v19M32 45v2" />
        </svg>
      </div>
      <h1>
        {{
          errorKind === "network"
            ? "网络连接失败"
            : errorKind === "maintenance"
              ? "咨询服务维护中"
              : errorKind === "disabled"
                ? "咨询服务暂未开放"
                : "暂时无法开始咨询"
        }}
      </h1>
      <p>{{ errorMessage(errorKind) }}</p>
      <button
        v-if="errorKind !== 'report_unavailable'"
        type="button"
        data-testid="ai-retry"
        @click="load"
      >
        重新加载
      </button>
      <RouterLink :to="backTo">返回报告</RouterLink>
    </section>

    <template v-else>
      <section class="ai-welcome-content">
        <div class="ai-hero">
          <div class="ai-hero-copy">
            <h1>你好，<br />一起读懂你的长寿报告</h1>
            <p class="ai-intro">从本次报告出发，了解指标与健康管理建议。</p>
          </div>
          <div class="ai-avatar"><img :src="avatar" alt="AI 男医生顾问形象" /></div>
        </div>
        <AiConsultReportCard :score="reportScore" :systems="focusSystems" :summary="welcome.report_summary" :date="welcome.report_date" :report-to="backTo" />

        <section
          v-if="managementPlans.length"
          class="ai-management-plans"
          data-testid="ai-management-plans"
          aria-labelledby="aiPlansTitle"
        >
          <h2 id="aiPlansTitle">
            为你匹配的健康管理方案
            <button
              v-if="managementPlans.length > 1"
              type="button"
              class="ai-plans-toggle"
              data-testid="ai-plans-toggle"
              :aria-expanded="plansExpanded"
              aria-controls="aiPlansList"
              :aria-label="plansExpanded ? '收起更多管理方案' : `显示其余 ${managementPlans.length - 1} 项管理方案，共 ${managementPlans.length} 项`"
              @click="plansExpanded = !plansExpanded"
            >
              {{ plansExpanded ? '收起' : '显示更多' }}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <span v-else>{{ managementPlans.length }} 项</span>
          </h2>
          <TransitionGroup id="aiPlansList" name="ai-plan-expand" tag="div" class="ai-plan-list">
            <article
              v-for="plan in visibleManagementPlans"
              :key="`${plan.plan_id}-${plan.indicator_code}`"
              class="ai-plan-item"
              data-testid="ai-management-plan"
            >
              <div class="ai-plan-item-clip">
                <RouterLink
                  class="ai-plan-card"
                  :to="{
                    name: 'system-detail',
                    params: { systemId: plan.system_code },
                    query: { ...reportQuery, fromAiConsult: '1' },
                  }"
                  :aria-label="`查看${plan.plan_name}及推荐依据`"
                  @click="rememberChatPosition"
                >
                  <div class="ai-plan-visual">
                    <img
                      v-if="plan.image_url && !failedPlanImages.has(plan.image_url)"
                      :src="resolveProductImageUrl(plan.image_url)"
                      :alt="plan.image_alt || plan.plan_name"
                      loading="lazy"
                      @error="failedPlanImages.add(plan.image_url)"
                    />
                    <svg v-else viewBox="0 0 48 48" aria-hidden="true">
                      <path
                        d="M12 35c2-18 8-22 25-22-1 18-7 24-21 24M12 39l19-20M19 32h11M25 26v-6"
                      />
                    </svg>
                  </div>
                  <div class="ai-plan-copy">
                    <h3>{{ plan.plan_name }}</h3>
                    <span class="ai-plan-issue" :style="scoreStyle(plan.indicator_score)" :data-score-level="scoreAppearance(plan.indicator_score).key"
                      >{{ plan.indicator_name }} · 活力值
                      <b class="score-value">{{ plan.indicator_score ?? "—" }}</b></span
                    >
                  </div>
                  <span class="ai-plan-arrow" aria-hidden="true"><span>查看方案</span
                    ><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg
                  ></span>
                </RouterLink>
              </div>
            </article>
          </TransitionGroup>
        </section>

        <section
          v-if="entryContext"
          class="ai-entry-context"
          data-testid="ai-entry-context"
        >
          <small>{{
            entryContext.type === "plan" ? "管理方案咨询" : "指标咨询"
          }}</small>
          <strong>{{
            entryContext.type === "plan"
              ? entryContext.plan_name
              : entryContext.indicator_name
          }}</strong>
          <p v-if="entryContext.type === 'plan'" :style="scoreStyle(entryContext.indicator_score)" :data-score-level="scoreAppearance(entryContext.indicator_score).key">
            已关联 {{ entryContext.indicator_name }}，本次
            <b class="score-value">{{ entryContext.indicator_score ?? "—" }}</b> 分；触发条件为低于
            {{ entryContext.trigger_score_below }} 分。
          </p>
          <p v-else-if="entryContext.stale_plan">
            原方案已不在当前有效推荐中，下面只根据这份报告解释关联指标，不会把旧方案当作当前推荐。
          </p>
          <p v-else>问题已关联到这份报告中的该项指标。</p>
        </section>

        <section class="ai-question-panel">
        <div class="ai-section-heading">
          <h2>{{ entryContext ? "已为你准备的问题" : "你可以这样问" }}</h2>
        </div>
        <div class="ai-suggestions">
          <button
            v-for="(question, index) in welcome.suggested_questions"
            :key="`${index}-${question}`"
            type="button"
            data-testid="ai-question"
            :disabled="!canSend || sending"
            @click="sendQuestion(question)"
          >
            <span
              class="ai-question-icon"
              :class="`ai-question-icon--${index % 4}`"
              aria-hidden="true"
            >
              <svg v-if="index % 4 === 0" viewBox="0 0 24 24">
                <path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6" />
              </svg>
              <svg v-else-if="index % 4 === 1" viewBox="0 0 24 24">
                <path d="M10 5v8M14 5v8M10 9C7 5 4 10 3 15c-1 5 6 5 7 1M14 9c3-4 6 1 7 6 1 5-6 5-7 1M10 13l2-2 2 2" />
              </svg>
              <svg v-else-if="index % 4 === 2" viewBox="0 0 24 24"><path d="M9 17h6M10 21h4M9 17v-2a7 7 0 1 1 6 0v2M12 4v6l-3 3" /></svg>
              <svg v-else viewBox="0 0 24 24">
                <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />
              </svg>
            </span>
            <span class="ai-question-copy"
              ><strong>{{ question }}</strong></span
            >
            <svg
              class="ai-question-arrow"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </div>
        </section>

        <p v-if="Number.isSafeInteger(welcome.remaining_today) && welcome.remaining_today >= 0" class="ai-quota-note" role="status" data-testid="ai-quota-note">
          今日剩余回答次数 <strong>{{ welcome.remaining_today }}</strong>
        </p>

        <section v-if="!serviceAvailable" class="ai-status" role="status">
          <strong>{{
            welcome.service_status === "maintenance"
              ? "咨询服务维护中"
              : "咨询服务暂未开放"
          }}</strong>
          <p>
            {{
              welcome.service_status === "maintenance"
                ? maintenanceText || "咨询服务正在维护，请稍后再试。"
                : "报告内容仍可查看；AI 问答开放后才能发送问题。"
            }}
          </p>
        </section>
        <section
          v-if="canAsk && admissionReason"
          class="ai-status"
          role="status"
          data-testid="ai-admission-status"
        >
          <strong>{{
            admissionReason === "session_ended" ? "本次咨询已结束" : ["daily_limit", "global_budget_exhausted"].includes(admissionReason)
              ? "今日咨询已达上限"
              : "稍后可以继续咨询"
          }}</strong>
          <p>{{ admissionText }}</p>
          <button v-if="sessionEnded" type="button" class="ai-start-again" data-testid="ai-start-again" @click="load">开始新咨询</button>
        </section>

        <section
          v-if="messages.length"
          class="ai-conversation"
          aria-label="咨询对话"
          data-testid="ai-conversation"
        >
          <article
            v-for="message in messages"
            :key="message.id"
            class="ai-turn"
          >
            <small class="ai-user-source">我</small>
            <div class="ai-user-question">{{ message.question }}</div>
            <time v-if="message.createdAt" class="ai-message-time" :datetime="new Date(message.createdAt).toISOString()">{{ messageTime(message.createdAt) }}</time>
            <div class="ai-answer" :aria-busy="message.status === 'loading'">
              <span class="ai-answer-avatar" aria-hidden="true"><img :src="avatar" alt="" /></span>
              <div class="ai-answer-main">
              <div class="ai-answer-heading"><strong>AI 长寿顾问</strong><span>AI</span></div>
              <div class="ai-answer-body">
                <p
                  v-if="message.status === 'loading' && !message.answer"
                  class="ai-answer-pending"
                >
                  <strong>正在结合报告整理建议</strong><span class="ai-typing-dots" aria-hidden="true"><i /><i /><i /></span>
                </p>
                <AiConsultAnswer
                  v-else-if="
                    message.status === 'completed' ||
                    (message.status === 'loading' && message.answer)
                  "
                  :answer="message.answer"
                  :evidence="message.evidence"
                  :streaming="message.status === 'loading'"
                  :report-code="reportParamsFromLocation().reportCode"
                  :customer-id="reportParamsFromLocation().customerId"
                />
                <p
                  v-else-if="message.status === 'timed_out'"
                  class="ai-answer-pending"
                >
                  回答状态暂未同步，请查询服务端状态
                </p>
                <p v-else class="ai-answer-pending">
                  {{
                    message.status === "stopped"
                      ? "已停止，本次回答未完成"
                      : "本次回答未完成"
                  }}
                </p>
                <section
                  v-if="maintainedActions(message).length"
                  class="ai-maintained-actions"
                  data-testid="ai-maintained-actions"
                >
                  <header>
                    <strong>行动建议</strong>
                    <small>来自指标后台维护</small>
                  </header>
                  <ol>
                    <li
                      v-for="(item, index) in maintainedActions(message)"
                      :key="`${item.id || index}-${index}`"
                    >
                      {{ item.text }}
                    </li>
                  </ol>
                  <small class="ai-maintained-note"
                    >这是报告中的维护资料；如与专业人员意见不一致，请以专业人员意见为准。</small
                  >
                </section>
                <button
                  v-if="
                    message.status === 'loading' &&
                    message.turnId &&
                    message.generationId
                  "
                  type="button"
                  class="ai-stop-button"
                  data-testid="ai-stop"
                  :disabled="stopBusy"
                  @click="stopCurrent(message)"
                >
                  停止生成
                </button>
                <button
                  v-if="message.status === 'timed_out' && message.turnId"
                  type="button"
                  class="ai-stop-button"
                  data-testid="ai-check-status"
                  :disabled="message.statusChecking"
                  @click="checkTimedOutTurn(message)"
                >
                  {{ message.statusChecking ? "正在查询…" : "查询回答状态" }}
                </button>
                <button
                  v-if="
                    message.retryable &&
                    message.turnId &&
                    message.generationId &&
                    canAsk &&
                    !sending
                  "
                  type="button"
                  class="ai-stop-button"
                  data-testid="ai-retry"
                  :disabled="!canSend"
                  @click="retryCurrent(message)"
                >
                  重新生成
                </button>
                <button
                  v-if="
                    message.retryable && !message.turnId && canAsk && !sending
                  "
                  type="button"
                  class="ai-stop-button"
                  data-testid="ai-resend-question"
                  :disabled="!canSend"
                  @click="sendQuestion(message.question, message)"
                >
                  重试发送原问题
                </button>
                <small
                  v-if="message.stopError"
                  class="ai-feedback-error"
                  role="alert"
                  >{{ message.stopError }}</small
                >
                <small
                  v-if="message.retryError"
                  class="ai-feedback-error"
                  role="alert"
                  >{{ message.retryError }}</small
                >
                </div>
                <div
                  v-if="message.status === 'completed' && message.turnId"
                  class="ai-feedback"
                  data-testid="ai-feedback"
                >
                  <span class="ai-accessibility-only">这条回答有帮助吗？</span>
                  <div class="ai-feedback-actions">
                    <button
                      type="button"
                      :aria-pressed="message.feedback === 'helpful'"
                      :disabled="message.feedbackBusy"
                      @click="rateAnswer(message, true)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10h-4v11h4V10Zm0 0 5-8c3 0 3 3 1 7h5c2 0 2 2 1 5l-2 7H8V10Z" /></svg>
                      有帮助
                    </button>
                    <button
                      type="button"
                      :aria-pressed="message.feedback === 'unhelpful'"
                      :disabled="message.feedbackBusy"
                      @click="feedbackReasonFor = message.id"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 14H4V3h4v11Zm0 0 5 8c3 0 3-3 1-7h5c2 0 2-2 1-5l-2-7H8v11Z" /></svg>
                      没有帮助
                    </button>
                  </div>
                  <div
                    v-if="feedbackReasonFor === message.id"
                    class="ai-feedback-reasons"
                  >
                    <span>可选原因</span>
                    <button
                      type="button"
                      :disabled="message.feedbackBusy"
                      @click="rateAnswer(message, false, 'inaccurate')"
                    >
                      不准确
                    </button>
                    <button
                      type="button"
                      :disabled="message.feedbackBusy"
                      @click="rateAnswer(message, false, 'unclear')"
                    >
                      看不懂
                    </button>
                    <button
                      type="button"
                      :disabled="message.feedbackBusy"
                      @click="rateAnswer(message, false, 'unresolved')"
                    >
                      没解决问题
                    </button>
                    <button
                      type="button"
                      :disabled="message.feedbackBusy"
                      @click="rateAnswer(message, false)"
                    >
                      跳过原因
                    </button>
                  </div>
                  <small
                    v-if="message.feedbackError"
                    class="ai-feedback-error"
                    role="alert"
                    >{{ message.feedbackError }}</small
                  >
                </div>
                <div v-if="canAsk && !sending && followUpSuggestions(message).length" class="ai-followup-prompts" aria-label="可继续追问">
                  <span class="ai-accessibility-only">继续了解</span>
                  <button v-for="question in followUpSuggestions(message)" :key="question" type="button" data-testid="ai-followup-prompt" :disabled="!canSend" @click="sendQuestion(question)">{{ question }}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button>
                </div>
              </div>
            </div>
          </article>
        </section>
        <button
          v-if="newReplyPending"
          type="button"
          class="ai-new-reply"
          data-testid="ai-new-reply"
          @click="scrollToLatest({ force: true })"
        >
          有新消息 · 查看最新 <span aria-hidden="true">↓</span>
        </button>
        <p v-if="chatError" class="ai-chat-error" role="alert">
          {{ chatError }}
        </p>
        <p v-if="!serviceAvailable" class="ai-footnote">
          AI 回答仅作健康管理参考，不替代医学诊断或治疗。
        </p>
      </section>

      <button
        v-if="showBackToTop && !newReplyPending"
        type="button"
        class="ai-back-to-top"
        :class="{ 'ai-back-to-top--with-composer': serviceAvailable }"
        aria-label="回到顶部"
        @click="scrollToPageTop"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V5m0 0-6 6m6-6 6 6" />
        </svg>
        <span>回到顶部</span>
      </button>

      <footer v-if="serviceAvailable" class="ai-composer-dock">
        <form
          class="ai-composer"
          data-testid="ai-composer"
          @submit.prevent="sendQuestion(questionText)"
        >
          <label class="ai-accessibility-only" for="aiQuestionInput"
            >问问我的长寿报告</label
          >
          <div class="ai-composer-row">
            <div class="ai-composer-field">
            <textarea
              id="aiQuestionInput"
              ref="questionInput"
              v-model="questionText"
              rows="1"
              :maxlength="questionLimit || undefined"
              :placeholder="messages.length ? '继续询问你的报告…' : '问问我的长寿报告…'"
              :disabled="sending || sessionEnded"
              @input="resizeQuestionInput"
            />
            <small class="ai-composer-count">{{ questionText.length }}<template v-if="questionLimit">/{{ questionLimit }}</template></small>
            </div>
            <button
              type="submit"
              :disabled="!canSend || sending || !questionText.trim()"
              aria-label="发送问题"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m21 3-6 18-4-8-8-4L21 3ZM11 13 21 3" />
              </svg>
            </button>
          </div>
          <div class="ai-composer-note">
            <span>AI 回答仅供健康管理参考，不替代医学诊断或治疗。</span>
          </div>
        </form>
      </footer>
    </template>
  </main>
  <Teleport to="body">
    <div v-if="leaveConfirmOpen" class="ai-leave-overlay" @click.self="finishLeaveDecision(false)">
      <section ref="leaveDialog" class="ai-leave-dialog" role="dialog" aria-modal="true" aria-labelledby="aiLeaveTitle" aria-describedby="aiLeaveDescription" @keydown="leaveDialogKeys">
        <h2 id="aiLeaveTitle">结束本次咨询？</h2>
        <p id="aiLeaveDescription">离开页面后，本次会话将结束。再次进入会开启新的咨询，当前对话不会恢复。</p>
        <div class="ai-leave-actions">
          <button ref="continueButton" type="button" data-testid="ai-leave-cancel" @click="finishLeaveDecision(false)">继续咨询</button>
          <button type="button" class="ai-leave-confirm" data-testid="ai-leave-confirm" @click="finishLeaveDecision(true)">结束并离开</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped src="../styles/ai-consult.css"></style>
