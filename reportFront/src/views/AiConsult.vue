<script setup>
import { onMounted, ref } from 'vue'
import { AiConsultApiError, loadConsultBootstrap } from '@/api/aiConsultClient.js'
import { reportParamsFromLocation, reportRouteQueryFromLocation } from '@/api/reportClient.js'
import AiConsultWelcomeSkeleton from '@/components/AiConsultWelcomeSkeleton.vue'
import avatar from '@/assets/ai-longevity-doctor-avatar.png'

const reportQuery = reportRouteQueryFromLocation()
const backTo = reportQuery.reportId ? { name: 'home', query: reportQuery } : { name: 'home' }
const state = ref('loading')
const errorKind = ref('')
const welcome = ref(null)
const noticeOpen = ref(false)

async function load() {
  const { reportCode, customerId } = reportParamsFromLocation()
  if (!reportCode || customerId === null) {
    errorKind.value = 'report_unavailable'
    state.value = 'error'
    return
  }
  state.value = 'loading'
  noticeOpen.value = false
  try {
    const data = await loadConsultBootstrap(reportCode, customerId)
    if (!data || !Array.isArray(data.suggested_questions) || typeof data.report_summary !== 'string') {
      throw new AiConsultApiError('unavailable')
    }
    welcome.value = data
    state.value = 'ready'
  } catch (error) {
    errorKind.value = error instanceof AiConsultApiError ? error.kind : 'network'
    state.value = 'error'
  }
}

function errorMessage(kind) {
  if (kind === 'report_unavailable') return '报告链接无效或报告暂时不可用。请返回报告页核对。'
  if (kind === 'network') return '网络连接失败，请检查网络后重试。'
  if (kind === 'rate_limited') return '访问较频繁，请稍后再试。'
  return '咨询服务暂时不可用，请稍后再试。'
}

onMounted(() => {
  document.title = 'AI 长寿顾问｜长寿指数'
  load()
})
</script>

<template>
  <AiConsultWelcomeSkeleton v-if="state === 'loading'" />
  <main v-else class="app-shell ai-consult-page" data-testid="ai-consult-welcome">
    <header class="ai-topbar">
      <RouterLink :to="backTo" class="ai-back" aria-label="返回报告"><svg viewBox="0 0 24 24"><path d="m14 5-7 7 7 7" /></svg></RouterLink>
      <div class="ai-topbar-title"><strong>AI 长寿顾问</strong><small>理解健康，陪你向前</small></div>
      <span class="ai-topbar-space" aria-hidden="true" />
    </header>

    <section v-if="state === 'error'" class="ai-error" role="alert">
      <div class="ai-error-icon" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" /><path d="M32 17v19M32 45v2" /></svg></div>
      <h1>{{ errorKind === 'network' ? '网络连接失败' : '暂时无法开始咨询' }}</h1>
      <p>{{ errorMessage(errorKind) }}</p>
      <button v-if="errorKind !== 'report_unavailable'" type="button" data-testid="ai-retry" @click="load">重新加载</button>
      <RouterLink :to="backTo">返回报告</RouterLink>
    </section>

    <template v-else>
      <section class="ai-report-strip" aria-label="当前关联报告">
        <span class="ai-report-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8 14h8M8 18h5" /></svg></span>
        <span><strong>已关联本次报告</strong><small v-if="welcome.report_date"><time :datetime="welcome.report_date">{{ welcome.report_date }}</time></small></span>
      </section>

      <section class="ai-welcome-content">
        <p class="ai-eyebrow">A LITTLE CLARITY. A BETTER YOU.</p>
        <div class="ai-hero">
          <h1>读懂身体，<br>更好地生活。</h1>
          <div class="ai-avatar"><span /><img :src="avatar" alt="AI 顾问形象"></div>
        </div>
        <p class="ai-intro">先从这份报告开始，找到值得关注的健康信号。</p>
        <div class="ai-report-summary">{{ welcome.report_summary }}</div>

        <div class="ai-section-heading"><span>可以从这里开始</span><i /></div>
        <div class="ai-suggestions">
          <button v-for="(question, index) in welcome.suggested_questions" :key="`${index}-${question}`" type="button" data-testid="ai-question" disabled>
            <span class="ai-question-icon" :class="`ai-question-icon--${index % 3}`" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            <span>{{ question }}</span>
          </button>
        </div>

        <section class="ai-status" role="status">
          <strong>咨询服务暂未开放</strong>
          <p>报告内容和使用说明可以查看；AI 问答开放后才能发送问题。</p>
        </section>
        <button v-if="welcome.notice" type="button" class="ai-notice-link" data-testid="ai-notice-open" @click="noticeOpen = true">查看数据使用说明</button>
        <p class="ai-footnote">AI 回答仅作健康管理参考，不替代医学诊断或治疗。</p>
      </section>
    </template>

    <div v-if="noticeOpen && welcome?.notice" class="ai-sheet-backdrop" @click.self="noticeOpen = false">
      <section class="ai-notice-sheet" role="dialog" aria-modal="true" aria-labelledby="aiNoticeTitle">
        <div class="ai-sheet-handle" aria-hidden="true" />
        <h2 id="aiNoticeTitle">数据使用说明</h2>
        <p>{{ welcome.notice.text }}</p>
        <div class="ai-notice-fact"><small>服务商标识</small><strong>{{ welcome.notice.provider_code }}</strong></div>
        <div class="ai-notice-fact"><small>处理范围</small><strong>{{ welcome.notice.data_scope_text }}</strong></div>
        <p class="ai-notice-hint">当前服务尚未开放，本页面不会记录同意，也不会向 AI 服务商发送报告数据。</p>
        <button type="button" data-testid="ai-notice-close" @click="noticeOpen = false">知道了</button>
      </section>
    </div>
  </main>
</template>

<style scoped>
.ai-consult-page { min-height: 100svh; background: #f6f9fc; color: #24344e; }
.ai-topbar { height: 72px; display: grid; grid-template-columns: 48px 1fr 48px; align-items: center; padding: 0 16px; background: #fff; }
.ai-back { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; }
.ai-back svg { width: 23px; height: 23px; }
.ai-topbar-title { text-align: center; }
.ai-topbar-title strong { display: block; font-size: 16px; line-height: 1.5; }
.ai-topbar-title small { display: block; color: #98a5b6; font-size: 10px; line-height: 1.5; }
.ai-report-strip { display: flex; align-items: center; gap: 12px; min-height: 68px; margin: 15px 18px 0; padding: 11px 15px; border: 1px solid #e1eaf5; border-radius: 18px; background: #fff; box-shadow: 0 4px 16px #415c8010; }
.ai-report-mark { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 12px; color: #688ec2; background: #edf4fc; }
.ai-report-mark svg { width: 20px; height: 20px; }
.ai-report-strip strong { display: block; font-size: 13px; font-weight: 650; }
.ai-report-strip small { display: block; margin-top: 3px; color: #94a5b9; font-size: 11px; }
.ai-welcome-content { padding: 34px 22px max(32px, env(safe-area-inset-bottom)); }
.ai-eyebrow { margin: 0 0 13px; color: #708fb8; font: 700 10px/1.5 ui-monospace, Menlo, monospace; letter-spacing: .13em; }
.ai-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; min-height: 104px; }
.ai-hero h1 { margin: 0; font-size: clamp(25px, 7vw, 31px); line-height: 1.38; font-weight: 700; letter-spacing: -.04em; }
.ai-avatar { position: relative; width: 112px; height: 114px; flex: none; overflow: hidden; border-radius: 50% 50% 44% 44%; }
.ai-avatar span { position: absolute; left: 3px; bottom: 0; width: 106px; height: 106px; border-radius: 50%; background: linear-gradient(145deg, #e0eeff, #d5e6f9); }
.ai-avatar img { position: absolute; left: -35px; top: -9px; width: 183px; max-width: none; height: 183px; object-fit: contain; }
.ai-intro { margin: 15px 0 0; color: #7c8da4; font-size: 15px; line-height: 1.8; }
.ai-report-summary { margin-top: 17px; padding: 13px 15px; border: 1px solid #e2eaf4; border-radius: 14px; background: #eef5fc; color: #526c91; font-size: 13px; line-height: 1.7; }
.ai-section-heading { display: flex; align-items: center; gap: 14px; margin: 29px 0 13px; color: #899ab1; font-size: 12px; }
.ai-section-heading i { flex: 1; height: 1px; background: #e1e9f2; }
.ai-suggestions { display: grid; gap: 10px; }
.ai-suggestions button { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 73px; padding: 14px; border: 1px solid #e7edf5; border-radius: 17px; background: #fff; color: #425674; text-align: left; font-size: 14px; line-height: 1.55; opacity: 1; cursor: not-allowed; }
.ai-question-icon { display: grid; place-items: center; width: 38px; height: 39px; flex: none; border-radius: 12px; color: #678fca; background: #edf4ff; font: 700 11px ui-monospace, Menlo, monospace; }
.ai-question-icon--1 { color: #8c8dbb; background: #f1eff9; }
.ai-question-icon--2 { color: #79a3a6; background: #edf6f5; }
.ai-status { margin-top: 22px; padding: 16px 17px; border: 1px solid #dce8f4; border-radius: 17px; background: #eaf3fb; }
.ai-status strong { color: #476994; font-size: 14px; }
.ai-status p { margin: 7px 0 0; color: #7188a4; font-size: 12px; line-height: 1.7; }
.ai-notice-link { display: block; width: 100%; margin-top: 20px; padding: 8px 0; border: 0; background: transparent; color: #557cb0; font-size: 13px; text-align: center; text-decoration: underline; text-underline-offset: 3px; }
.ai-footnote { margin: 17px 0 0; color: #9daaba; font-size: 11px; line-height: 1.7; text-align: center; }
.ai-error { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: calc(100svh - 72px); padding: 24px 26px 72px; text-align: center; }
.ai-error-icon { display: grid; place-items: center; width: 104px; height: 104px; border-radius: 50%; background: #e8f1fb; color: #6994c5; }
.ai-error-icon svg { width: 58px; height: 58px; }
.ai-error h1 { margin: 24px 0 0; font-size: 23px; }
.ai-error p { max-width: 290px; margin: 12px 0 0; color: #7d8ea5; font-size: 14px; line-height: 1.8; }
.ai-error button { width: min(100%, 240px); min-height: 48px; margin-top: 30px; border: 0; border-radius: 14px; background: #5179bd; color: #fff; font-size: 14px; }
.ai-error a { margin-top: 18px; color: #6588b7; font-size: 13px; }
.ai-sheet-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; background: #263d5650; }
.ai-notice-sheet { width: 100%; max-height: 88svh; overflow-y: auto; padding: 11px 22px max(26px, env(safe-area-inset-bottom)); border-radius: 26px 26px 0 0; background: #fbfdff; box-shadow: 0 -15px 50px #243b5f13; }
.ai-sheet-handle { width: 32px; height: 4px; margin: 0 auto 17px; border-radius: 4px; background: #dce5f0; }
.ai-notice-sheet h2 { margin: 0 0 15px; font-size: 20px; }
.ai-notice-sheet>p { margin: 0 0 15px; color: #72849d; font-size: 14px; line-height: 1.85; white-space: pre-wrap; }
.ai-notice-fact { padding: 13px 0; border-top: 1px solid #e6edf5; }
.ai-notice-fact small { display: block; color: #94a5b8; font-size: 11px; }
.ai-notice-fact strong { display: block; margin-top: 6px; color: #405c82; font-size: 13px; line-height: 1.7; font-weight: 550; overflow-wrap: anywhere; }
.ai-notice-sheet .ai-notice-hint { margin-top: 12px; padding: 12px; border-radius: 12px; background: #edf4fb; font-size: 11px; }
.ai-notice-sheet button { width: 100%; min-height: 46px; border: 0; border-radius: 13px; color: #fff; background: #587dbb; font-size: 14px; }
.ai-back:focus-visible, .ai-notice-link:focus-visible, .ai-notice-sheet button:focus-visible, .ai-error button:focus-visible { outline: 3px solid #8db4ef; outline-offset: 3px; }
@media (max-width: 359px) { .ai-welcome-content { padding-inline: 18px; } .ai-report-strip { margin-inline: 14px; } .ai-avatar { width: 96px; } .ai-avatar img { left: -43px; } .ai-eyebrow { font-size: 9px; } }
</style>
