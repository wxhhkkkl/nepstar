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
import AiConsultEvidence from "@/components/AiConsultEvidence.vue";
import AiConsultWelcomeSkeleton from "@/components/AiConsultWelcomeSkeleton.vue";
import avatar from "@/assets/ai-longevity-doctor-avatar.png";
import { resolveProductImageUrl } from "@/data/reportAdapter.js";

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
const failedPlanImages = ref(new Set());
const greeting = (() => {
  const hour = new Date().getHours();
  return hour < 6
    ? "你好"
    : hour < 12
      ? "早上好"
      : hour < 18
        ? "下午好"
        : "晚上好";
})();
const messages = ref([]);
const questionText = ref("");
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

async function load() {
  const { reportCode, customerId } = reportParamsFromLocation();
  reportQuery.value = reportRouteQueryFromLocation();
  if (!reportCode || customerId === null) {
    errorKind.value = "report_unavailable";
    state.value = "error";
    return;
  }
  state.value = "loading";
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
  scrollListening = true;
}

function unbindPageScroll() {
  if (!scrollListening) return;
  window.removeEventListener("scroll", onPageScroll);
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
  sending.value = true;
  chatError.value = "";
  const message =
    existingMessage ||
    reactive({
      id: crypto.randomUUID(),
      turnId: null,
      generationId: null,
      question,
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
  if (existingMessage) {
    message.status = "loading";
    message.answer = "";
    message.evidence = [];
    message.retryable = false;
    message.retryError = "";
  }
  const controller = new AbortController();
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
          <div class="ai-avatar"><img :src="avatar" alt="AI 顾问形象" /></div>
          <div class="ai-hero-copy">
            <p class="ai-eyebrow">YOUR LONGEVITY COMPANION</p>
            <h1>{{ greeting }}，<br />想先了解哪项长寿指标？</h1>
          </div>
          <p class="ai-intro">
            从你的本次报告出发，了解身体系统、指标趋势与健康管理方案。
          </p>
        </div>

        <section class="ai-report-strip" aria-label="当前关联报告">
          <div class="ai-report-score">
            <small>已连接长寿报告</small>
            <strong v-if="reportScore !== null" data-testid="ai-report-score"
              >{{ reportScore }}<span>分</span></strong
            >
            <strong v-else class="ai-score-missing">分数未提供</strong>
          </div>
          <ul v-if="focusSystems.length" class="ai-report-focus">
            <li v-for="system in focusSystems" :key="system.name">
              {{ system.name }} · 活力值 {{ system.score }}
            </li>
          </ul>
          <p v-else class="ai-report-focus ai-report-summary">
            {{ welcome.report_summary }}
          </p>
          <span class="ai-report-badge">已连接</span>
        </section>
        <div class="ai-report-meta">
          <span v-if="welcome.report_date"
            >检测日期
            <time :datetime="welcome.report_date">{{
              welcome.report_date
            }}</time></span
          >
          <span class="ai-accessibility-only">{{
            welcome.report_summary
          }}</span>
        </div>

        <section
          v-if="managementPlans.length"
          class="ai-management-plans"
          data-testid="ai-management-plans"
          aria-labelledby="aiPlansTitle"
        >
          <h2 id="aiPlansTitle">
            本次为你匹配
            <span>{{ managementPlans.length }}</span> 项健康管理方案
          </h2>
          <article
            v-for="plan in managementPlans"
            :key="`${plan.plan_id}-${plan.indicator_code}`"
            data-testid="ai-management-plan"
          >
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
                <span class="ai-plan-issue"
                  >{{ plan.indicator_name }} · 活力值
                  {{ plan.indicator_score ?? "—" }}</span
                >
                <p>{{ plan.description || "查看本次报告的方案与推荐依据" }}</p>
              </div>
              <span class="ai-plan-arrow" aria-hidden="true"
                ><svg viewBox="0 0 24 24">
                  <path d="M5 12h14m-6-6 6 6-6 6" /></svg
              ></span>
            </RouterLink>
          </article>
        </section>

        <p
          v-if="
            Number.isSafeInteger(welcome.remaining_today) &&
            welcome.remaining_today >= 0
          "
          class="ai-quota-note"
          role="status"
          data-testid="ai-quota-note"
        >
          今日剩余回答次数 <strong>{{ welcome.remaining_today }}</strong>
        </p>

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
          <p v-if="entryContext.type === 'plan'">
            已关联 {{ entryContext.indicator_name }}，本次
            {{ entryContext.indicator_score ?? "—" }} 分；触发条件为低于
            {{ entryContext.trigger_score_below }} 分。
          </p>
          <p v-else-if="entryContext.stale_plan">
            原方案已不在当前有效推荐中，下面只根据这份报告解释关联指标，不会把旧方案当作当前推荐。
          </p>
          <p v-else>问题已关联到这份报告中的该项指标。</p>
        </section>

        <div class="ai-section-heading">
          <h2>{{ entryContext ? "已为你准备的问题" : "你可以这样问" }}</h2>
          <small>基于本次报告</small>
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
              :class="`ai-question-icon--${index % 3}`"
              aria-hidden="true"
            >
              <svg v-if="index % 3 === 0" viewBox="0 0 24 24">
                <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
                <path d="m8 12 3 3 5-6" />
              </svg>
              <svg v-else-if="index % 3 === 1" viewBox="0 0 24 24">
                <path d="M3 20h18M4 15l5-6 4 3 7-8m-5 0h5v5" />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <path
                  d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"
                />
              </svg>
            </span>
            <span class="ai-question-copy"
              ><strong>{{ question }}</strong
              ><small>{{
                index % 3 === 0
                  ? "了解报告数据与关注重点"
                  : index % 3 === 1
                    ? "结合指标结果，理解健康信号"
                    : "从本次报告开始，梳理管理方向"
              }}</small></span
            >
            <svg
              class="ai-question-arrow"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
        </div>

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
            <small class="ai-user-source">你的问题与补充</small>
            <div class="ai-user-question">{{ message.question }}</div>
            <div class="ai-answer" :aria-busy="message.status === 'loading'">
              <span class="ai-answer-avatar" aria-hidden="true">AI</span>
              <div class="ai-answer-body">
                <strong>AI 长寿顾问</strong>
                <p
                  v-if="message.status === 'loading' && !message.answer"
                  class="ai-answer-pending"
                >
                  正在核对报告依据…
                </p>
                <p
                  v-else-if="
                    message.status === 'completed' ||
                    (message.status === 'loading' && message.answer)
                  "
                  class="ai-answer-text"
                >
                  {{ message.answer }}
                </p>
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
                <AiConsultEvidence
                  v-if="message.status === 'completed'"
                  :items="message.evidence"
                  :report-code="reportParamsFromLocation().reportCode"
                  :customer-id="reportParamsFromLocation().customerId"
                  :report-query="reportQuery"
                  @navigate="rememberChatPosition"
                />
                <div
                  v-if="
                    canAsk && !sending && followUpSuggestions(message).length
                  "
                  class="ai-followup-prompts"
                  aria-label="可继续追问"
                >
                  <span>继续了解</span>
                  <button
                    v-for="question in followUpSuggestions(message)"
                    :key="question"
                    type="button"
                    data-testid="ai-followup-prompt"
                    :disabled="!canSend"
                    @click="sendQuestion(question)"
                  >
                    {{ question }}
                  </button>
                </div>
                <div
                  v-if="message.status === 'completed' && message.turnId"
                  class="ai-feedback"
                  data-testid="ai-feedback"
                >
                  <span>这条回答有帮助吗？</span>
                  <div class="ai-feedback-actions">
                    <button
                      type="button"
                      :aria-pressed="message.feedback === 'helpful'"
                      :disabled="message.feedbackBusy"
                      @click="rateAnswer(message, true)"
                    >
                      有帮助
                    </button>
                    <button
                      type="button"
                      :aria-pressed="message.feedback === 'unhelpful'"
                      :disabled="message.feedbackBusy"
                      @click="feedbackReasonFor = message.id"
                    >
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
                  <small v-if="message.feedback && !message.feedbackError">{{
                    message.feedback === "helpful"
                      ? "已记录：有帮助"
                      : "已记录：没有帮助"
                  }}</small>
                  <small
                    v-if="message.feedbackError"
                    class="ai-feedback-error"
                    role="alert"
                    >{{ message.feedbackError }}</small
                  >
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
        <p class="ai-footnote">
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
          <div>
            <textarea
              id="aiQuestionInput"
              v-model="questionText"
              rows="1"
              :maxlength="questionLimit || undefined"
              placeholder="问问我的长寿报告"
              :disabled="sending || sessionEnded"
            />
            <button
              type="submit"
              :disabled="!canSend || sending || !questionText.trim()"
              aria-label="发送问题"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 4 16 8-16 8 3-8-3-8Zm3 8h13" />
              </svg>
            </button>
          </div>
          <div class="ai-composer-note">
            <span>AI 生成内容仅供健康管理参考</span
            ><small
              >{{ questionText.length }}<template v-if="questionLimit"
                >/{{ questionLimit }}</template
              ></small
            >
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

<style scoped>
.ai-leave-overlay { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:24px; background:#17263f66; }
.ai-leave-dialog { width:min(100%, 350px); box-sizing:border-box; padding:28px 24px 24px; border:1px solid #e1e9f3; border-radius:24px; background:#fff; color:#17263f; box-shadow:0 20px 60px #17263f33; }
.ai-leave-dialog h2 { margin:0 0 10px; font-size:20px; text-align:center; }
.ai-leave-dialog p { margin:0; color:#718199; font-size:14px; line-height:1.75; }
.ai-leave-actions { display:flex; gap:10px; margin-top:24px; }
.ai-leave-actions button { flex:1; min-height:46px; padding:10px 8px; border:1px solid #dce6f2; border-radius:13px; background:#f6f9fc; color:#526c8d; font-size:14px; font-weight:600; cursor:pointer; }
.ai-leave-actions .ai-leave-confirm { border-color:#527bb4; background:#527bb4; color:#fff; }
.ai-start-again { margin-top:14px; padding:9px 14px; border:1px solid #c5d8ed; border-radius:10px; background:#fff; color:#476994; font-size:13px; cursor:pointer; }
.ai-consult-page {
  position: relative;
  isolation: isolate;
  overflow: clip;
  max-width: 480px;
  min-height: 100svh;
  background:
    radial-gradient(ellipse at 100% 0%, #e7eaf9a6, transparent 40%),
    radial-gradient(ellipse at 0% 36%, #e0f2f5a6, transparent 48%), #f6f9fc;
  color: #17263f;
}
.ai-consult-page::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0 0 auto;
  height: 400px;
  pointer-events: none;
  background: radial-gradient(#b8cae45e 0.6px, transparent 0.8px) 0 0 / 10px
    10px;
  mask-image: linear-gradient(#000, transparent);
}
.ai-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 88px;
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: center;
  padding: 8px 20px 0;
  background: linear-gradient(
    180deg,
    rgba(246, 249, 252, 0.8) 0%,
    rgba(246, 249, 252, 0.62) 72%,
    rgba(246, 249, 252, 0.2) 100%
  );
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.ai-topbar::after {
  content: "";
  position: absolute;
  inset: 100% 0 auto;
  height: 18px;
  background: linear-gradient(
    180deg,
    rgba(246, 249, 252, 0.2),
    rgba(246, 249, 252, 0)
  );
  pointer-events: none;
}
.ai-back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid #fff9;
  border-radius: 50%;
  background: #ffffff9c;
}
.ai-back svg {
  width: 22px;
  height: 22px;
}
.ai-topbar-title {
  text-align: center;
}
.ai-topbar-title strong {
  display: block;
  margin-top: 4px;
  font-size: 20px;
  line-height: 1.5;
}
.ai-topbar-title small {
  display: block;
  color: #7e8da6;
  font:
    750 10px/1.5 ui-monospace,
    Menlo,
    monospace;
  letter-spacing: 0.17em;
}
.ai-welcome-content {
  padding: 26px 16px calc(156px + env(safe-area-inset-bottom));
}
.ai-hero {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  column-gap: 15px;
  row-gap: 12px;
  padding: 0 7px;
}
.ai-hero-copy {
  min-width: 0;
}
.ai-eyebrow {
  margin: 0 0 12px;
  color: #6282b1;
  font:
    750 9px/1.5 ui-monospace,
    Menlo,
    monospace;
  letter-spacing: 0.12em;
}
.ai-hero h1 {
  margin: 0;
  font-size: clamp(22px, 6.3vw, 26px);
  line-height: 1.36;
  font-weight: 750;
  letter-spacing: -0.045em;
}
.ai-avatar {
  position: relative;
  width: 88px;
  height: 94px;
  overflow: hidden;
  border: 1px solid #d9e6f1;
  border-radius: 28px;
  background: linear-gradient(145deg, #fbfdff, #e7f1f9);
  box-shadow: 0 12px 32px #436c8a0b;
}
.ai-avatar img {
  position: absolute;
  left: -7px;
  top: 6px;
  width: 104px;
  max-width: none;
  height: auto;
}
.ai-intro {
  grid-column: 2;
  margin: 0;
  color: #73839b;
  font-size: 13px;
  line-height: 1.8;
}
.ai-report-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 84px;
  margin-top: 20px;
  padding: 14px 15px;
  border: 1px solid #fff;
  border-radius: 25px;
  background: #ffffffd9;
  box-shadow: 0 9px 30px #415c8005;
}
.ai-report-score {
  flex: none;
}
.ai-report-score > small {
  display: block;
  color: #7385a1;
  font-size: 11px;
  line-height: 1.5;
}
.ai-report-score > strong {
  display: block;
  margin-top: 4px;
  color: #426be2;
  font-size: 32px;
  font-weight: 750;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
}
.ai-report-score > strong span {
  margin-left: 4px;
  font-size: 12px;
  letter-spacing: 0;
}
.ai-report-score > .ai-score-missing {
  font-size: 13px;
  line-height: 2;
}
.ai-report-focus {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 7px;
  margin: 0;
  padding: 2px 0 2px 12px;
  border-left: 1px solid #dce7f4;
  color: #576983;
  font-size: 11px;
  line-height: 1.5;
  list-style: none;
}
.ai-report-focus li {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.ai-report-focus li::before {
  content: "";
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: 50%;
  background: #5caaa8;
}
.ai-report-focus li:nth-child(2)::before {
  background: #c49c5b;
}
.ai-report-badge {
  flex: none;
  padding: 7px 9px;
  border-radius: 20px;
  background: #edf7f7;
  color: #458c90;
  font-size: 10px;
  font-weight: 650;
  white-space: nowrap;
}
.ai-report-meta {
  margin: 8px 6px 0;
  color: #8c9aaf;
  font-size: 10px;
  line-height: 1.5;
}
.ai-accessibility-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
.ai-management-plans {
  display: grid;
  gap: 9px;
  margin-top: 18px;
  padding: 14px 11px 11px;
  border: 1px solid #dfe6e5;
  border-radius: 25px;
  background: linear-gradient(125deg, #edf4f2d9, #f7f5ecb3);
}
.ai-management-plans h2 {
  margin: 0 5px 3px;
  font-size: 14px;
  line-height: 1.6;
  font-weight: 700;
}
.ai-plan-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px;
  border: 1px solid #e9e9e3;
  border-radius: 19px;
  background: #ffffffed;
}
.ai-plan-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 106px;
  height: 84px;
  flex: none;
  overflow: hidden;
  border-radius: 15px;
  background: linear-gradient(140deg, #f4eee4, #e5eeea);
  color: #729989;
}
.ai-plan-visual img {
  display: block;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ai-plan-visual svg {
  width: 45px;
  height: 45px;
  stroke-width: 1.3;
}
.ai-plan-copy {
  flex: 1;
  min-width: 0;
  padding-block: 5px;
}
.ai-plan-copy h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.45;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.ai-plan-issue {
  display: inline-block;
  max-width: 100%;
  margin-top: 7px;
  padding: 4px 7px;
  border-radius: 12px;
  color: #4c6d92;
  background: #eaf2fb;
  font-size: 10px;
  line-height: 1.4;
}
.ai-plan-copy p {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin: 7px 0 0;
  color: #7d8da4;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.ai-plan-arrow {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  margin-right: 6px;
  border-radius: 50%;
  background: #edf3fb;
  color: #6182ab;
}
.ai-plan-arrow svg {
  width: 18px;
  height: 18px;
}
.ai-entry-context {
  display: grid;
  gap: 5px;
  margin: 18px 0 22px;
  padding: 15px 16px;
  border: 1px solid #dce8f5;
  border-radius: 16px;
  background: linear-gradient(135deg, #f5f9fe, #edf4fb);
}
.ai-entry-context small {
  color: #6082ad;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.14em;
}
.ai-entry-context strong {
  color: #20334f;
  font-size: 16px;
}
.ai-entry-context p {
  margin: 0;
  color: #71839b;
  font-size: 12px;
  line-height: 1.65;
}
.ai-quota-note {
  margin: 10px 2px 0;
  color: #8798ad;
  font-size: 12px;
  line-height: 1.6;
}
.ai-quota-note strong {
  margin-left: 4px;
  color: #557cb0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.ai-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 23px 5px 12px;
}
.ai-section-heading h2 {
  margin: 0;
  font-size: 19px;
  line-height: 1.5;
  font-weight: 750;
  letter-spacing: -0.025em;
}
.ai-section-heading > small {
  flex: none;
  color: #8799b2;
  font-size: 10px;
}
.ai-suggestions {
  display: grid;
  gap: 9px;
}
.ai-suggestions button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 82px;
  padding: 13px;
  border: 1px solid #fff;
  border-radius: 22px;
  background: #ffffffd9;
  color: #25354f;
  text-align: left;
  opacity: 1;
  cursor: pointer;
}
.ai-suggestions button:disabled {
  cursor: not-allowed;
}
.ai-question-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 43px;
  flex: none;
  border-radius: 14px;
  color: #688aba;
  background: #eaf2fa;
}
.ai-question-icon svg {
  width: 24px;
  height: 24px;
}
.ai-question-icon--1 {
  color: #5b999b;
  background: #eaf5f5;
}
.ai-question-icon--2 {
  color: #8c8dbb;
  background: #f1eff9;
}
.ai-question-copy {
  flex: 1;
  min-width: 0;
}
.ai-question-copy strong {
  display: block;
  font-size: 14px;
  line-height: 1.55;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.ai-question-copy small {
  display: block;
  margin-top: 5px;
  color: #8190a6;
  font-size: 11px;
  line-height: 1.5;
}
.ai-question-arrow {
  width: 19px;
  height: 19px;
  flex: none;
  color: #8797b0;
}
.ai-status {
  margin-top: 22px;
  padding: 16px 17px;
  border: 1px solid #dce8f4;
  border-radius: 17px;
  background: #eaf3fb;
}
.ai-status strong {
  color: #476994;
  font-size: 14px;
}
.ai-status p {
  margin: 7px 0 0;
  color: #7188a4;
  font-size: 12px;
  line-height: 1.7;
}
.ai-conversation {
  display: grid;
  gap: 24px;
  margin-top: 28px;
}
.ai-new-reply {
  position: fixed;
  z-index: 20;
  left: 50%;
  bottom: calc(134px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: min(230px, calc(100vw - 32px));
  min-height: 46px;
  padding: 10px 16px;
  border: 1px solid #b8d1ed;
  border-radius: 24px;
  background: #f5faff;
  box-shadow: 0 10px 28px #456c9a32;
  color: #416da7;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.ai-new-reply span {
  font-size: 17px;
  line-height: 1;
}
.ai-back-to-top {
  position: fixed;
  z-index: 24;
  right: max(14px, calc((100vw - 480px) / 2 + 16px));
  bottom: calc(20px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 42px;
  padding: 0 13px;
  border: 1px solid #d9e5f1;
  border-radius: 22px;
  background: rgba(250, 253, 255, 0.96);
  box-shadow: 0 8px 24px rgba(49, 76, 112, 0.16);
  color: #5277a7;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.ai-back-to-top--with-composer {
  bottom: calc(112px + env(safe-area-inset-bottom));
}
.ai-back-to-top svg {
  width: 16px;
  height: 16px;
}
.ai-turn {
  display: grid;
  gap: 12px;
}
.ai-user-source {
  justify-self: end;
  margin: 0 4px -7px 0;
  color: #92a2b7;
  font-size: 10px;
  line-height: 1.4;
}
.ai-user-question {
  justify-self: end;
  max-width: 88%;
  padding: 12px 15px;
  border-radius: 18px 18px 5px 18px;
  background: #dfeeff;
  color: #365b8a;
  font-size: 14px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.ai-answer {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.ai-answer-avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 10px;
  background: #dceafb;
  color: #4d78b0;
  font:
    750 10px ui-monospace,
    Menlo,
    monospace;
}
.ai-answer-body {
  flex: 1;
  min-width: 0;
  padding: 13px 14px;
  border: 1px solid #e4ebf4;
  border-radius: 6px 17px 17px 17px;
  background: #fff;
  box-shadow: 0 5px 18px #415c8010;
}
.ai-answer-body > strong {
  color: #526d92;
  font-size: 11px;
}
.ai-answer-body > p {
  margin: 9px 0 0;
  font-size: 14px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.ai-answer-text {
  white-space: pre-wrap;
}
.ai-answer-pending {
  color: #8b9cb1;
}
.ai-maintained-actions {
  margin-top: 13px;
  padding: 12px;
  border: 1px solid #dce9f5;
  border-radius: 13px;
  background: #f5f9fd;
}
.ai-maintained-actions header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ai-maintained-actions header strong {
  color: #476b98;
  font-size: 12px;
}
.ai-maintained-actions header small,
.ai-maintained-note {
  color: #899bb1;
  font-size: 10px;
  line-height: 1.5;
}
.ai-maintained-actions ol {
  display: grid;
  gap: 7px;
  margin: 9px 0 0;
  padding-left: 19px;
  color: #4f6581;
  font-size: 12px;
  line-height: 1.65;
}
.ai-maintained-note {
  display: block;
  margin-top: 9px;
}
.ai-stop-button {
  min-height: 40px;
  margin-top: 12px;
  padding: 7px 13px;
  border: 1px solid #d8e3f0;
  border-radius: 10px;
  background: #f5f8fc;
  color: #5e7898;
  font-size: 12px;
}
.ai-feedback {
  display: grid;
  gap: 8px;
  margin-top: 15px;
  padding-top: 12px;
  border-top: 1px solid #edf1f6;
  color: #8596ad;
  font-size: 11px;
}
.ai-feedback-actions,
.ai-feedback-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
}
.ai-feedback button {
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #dfe8f3;
  border-radius: 10px;
  background: #f7faff;
  color: #607fa8;
  font-size: 11px;
}
.ai-feedback button[aria-pressed="true"] {
  border-color: #9fbee8;
  background: #e8f2ff;
  color: #3d6da9;
}
.ai-feedback button:disabled {
  opacity: 0.55;
}
.ai-feedback-reasons {
  padding: 8px 0;
}
.ai-feedback-reasons > span {
  width: 100%;
}
.ai-feedback small {
  color: #7896b4;
}
.ai-feedback .ai-feedback-error {
  color: #a75954;
}
.ai-followup-prompts {
  display: grid;
  justify-items: start;
  gap: 7px;
  margin-top: 13px;
}
.ai-followup-prompts > span {
  color: #92a2b7;
  font-size: 10px;
}
.ai-followup-prompts button {
  min-height: 38px;
  max-width: 100%;
  padding: 8px 11px;
  border: 1px solid #dce8f5;
  border-radius: 12px;
  background: #f5f9fe;
  color: #5879a3;
  font-size: 11px;
  line-height: 1.45;
  text-align: left;
  overflow-wrap: anywhere;
}
.ai-followup-prompts button:focus-visible {
  outline: 2px solid #8db4ef;
  outline-offset: 2px;
}
.ai-chat-error {
  margin: 13px 0 0;
  color: #a75954;
  font-size: 12px;
  line-height: 1.7;
}
.ai-composer-dock {
  position: fixed;
  z-index: 15;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: linear-gradient(0deg, #f0f5fb 88%, #f0f5fb00);
}
.ai-privacy-note {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  color: #8a99af;
  font-size: 10px;
  line-height: 1.5;
}
.ai-privacy-note svg {
  width: 13px;
  height: 13px;
  flex: none;
}
.ai-composer {
  padding: 10px 14px;
  border: 1px solid #fff;
  border-radius: 25px;
  background: #fff;
  box-shadow: 0 5px 28px #45648409;
}
.ai-composer > div:first-of-type {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ai-composer textarea {
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  height: 42px;
  min-height: 42px;
  max-height: 96px;
  resize: none;
  border: 0;
  outline: 0;
  padding: 9px 12px;
  background: transparent;
  color: #2e4667;
  font: inherit;
  font-size: 14px;
  line-height: 20px;
}
.ai-composer textarea::placeholder {
  color: #95a3b8;
  font-size: 14px;
  font-weight: 400;
  opacity: 1;
}
.ai-composer textarea:focus-visible {
  outline: 2px solid #9fbbe0;
  outline-offset: 2px;
  border-radius: 6px;
}
.ai-composer button {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: none;
  border: 0;
  border-radius: 50%;
  background: #213957;
  color: #fff;
}
.ai-composer button svg {
  width: 22px;
  height: 22px;
}
.ai-composer button:disabled {
  opacity: 0.45;
}
.ai-composer-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
  color: #8c9bb1;
  font-size: 10px;
  line-height: 1.5;
}
.ai-composer-note small {
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}
.ai-footnote {
  margin: 17px 0 0;
  color: #9daaba;
  font-size: 11px;
  line-height: 1.7;
  text-align: center;
}
.ai-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100svh - 88px);
  padding: 24px 26px 72px;
  text-align: center;
}
.ai-error-icon {
  display: grid;
  place-items: center;
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background: #e8f1fb;
  color: #6994c5;
}
.ai-error-icon svg {
  width: 58px;
  height: 58px;
}
.ai-error h1 {
  margin: 24px 0 0;
  font-size: 23px;
}
.ai-error p {
  max-width: 290px;
  margin: 12px 0 0;
  color: #7d8ea5;
  font-size: 14px;
  line-height: 1.8;
}
.ai-error button {
  width: min(100%, 240px);
  min-height: 48px;
  margin-top: 30px;
  border: 0;
  border-radius: 14px;
  background: #5179bd;
  color: #fff;
  font-size: 14px;
}
.ai-error a {
  margin-top: 18px;
  color: #6588b7;
  font-size: 13px;
}
.ai-back:focus-visible,
.ai-error button:focus-visible,
.ai-composer button:focus-visible,
.ai-suggestions button:focus-visible,
.ai-feedback button:focus-visible,
.ai-new-reply:focus-visible,
.ai-back-to-top:focus-visible,
.ai-plan-card:focus-visible {
  outline: 3px solid #8db4ef;
  outline-offset: 3px;
}
@media (max-width: 359px) {
  .ai-welcome-content {
    padding-inline: 12px;
  }
  .ai-topbar {
    padding-inline: 14px;
  }
  .ai-hero {
    grid-template-columns: 72px minmax(0, 1fr);
    column-gap: 12px;
    padding-inline: 3px;
  }
  .ai-avatar {
    width: 72px;
    height: 83px;
    border-radius: 24px;
  }
  .ai-avatar img {
    width: 88px;
    left: -8px;
  }
  .ai-eyebrow {
    font-size: 8px;
    letter-spacing: 0.035em;
  }
  .ai-intro {
    font-size: 12px;
  }
  .ai-report-strip {
    padding-inline: 12px;
    gap: 8px;
  }
  .ai-report-focus {
    padding-left: 8px;
    font-size: 10px;
  }
  .ai-report-badge {
    padding-inline: 7px;
    font-size: 9px;
  }
  .ai-plan-card {
    gap: 9px;
  }
  .ai-plan-visual {
    width: 79px;
    height: 94px;
  }
  .ai-plan-copy h3 {
    font-size: 13px;
  }
  .ai-plan-arrow {
    width: 24px;
    height: 24px;
    margin-right: 3px;
  }
  .ai-section-heading h2 {
    font-size: 18px;
  }
  .ai-suggestions button {
    gap: 10px;
    padding: 12px;
  }
  .ai-question-icon {
    width: 36px;
    height: 39px;
  }
  .ai-question-copy strong {
    font-size: 13px;
  }
}
</style>
