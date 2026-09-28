<script setup>
import { computed } from 'vue'
import { ERROR_KINDS } from '@/api/reportClient.js'

const props = defineProps({
  kind: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  backTo: { type: [Object, String], default: null },
  backLabel: { type: String, default: '返回上一级' },
})

// 报告不存在与无权访问对外仍合并展示，避免泄露报告是否存在。
const MESSAGES = {
  [ERROR_KINDS.NOT_FOUND]: { eyebrow: 'REPORT NOT FOUND', title: '报告打不开', detail: '报告不存在，或这份报告不属于当前账户。', hint: '请核对链接中的报告编号和账户信息', visual: 'missing' },
  [ERROR_KINDS.NOT_READY]: { eyebrow: 'REPORT IN PROGRESS', title: '报告尚未生成完成', detail: '报告还在生成中，请稍后再试。', hint: '稍后可使用同一链接继续查看', visual: 'progress' },
  [ERROR_KINDS.SYSTEM_NOT_FOUND]: { eyebrow: 'SYSTEM UNAVAILABLE', title: '该系统不属于此报告', detail: '当前报告中没有这一系统，请重新选择。', visual: 'missing' },
  [ERROR_KINDS.INDICATOR_NOT_FOUND]: { eyebrow: 'INDICATOR UNAVAILABLE', title: '该指标不属于此报告', detail: '当前报告中没有这一指标，请重新选择。', visual: 'missing' },
  [ERROR_KINDS.ROUTE_NOT_FOUND]: { eyebrow: 'PAGE NOT FOUND', title: '页面未找到', detail: '链接地址可能有误，或页面已调整。', hint: '请核对链接后重新打开', visual: 'route' },
  [ERROR_KINDS.UNAVAILABLE]: { eyebrow: 'SERVICE UNAVAILABLE', title: '报告服务暂时不可用', detail: '报告数据暂时无法读取，请稍后重试。', hint: '稍后刷新即可重新尝试', visual: 'service' },
  [ERROR_KINDS.NETWORK]: { eyebrow: 'CONNECTION INTERRUPTED', title: '网络连接失败', detail: '报告暂时无法加载，请检查网络后重试。', hint: '如果网络已恢复，点击按钮继续查看报告', visual: 'network' },
}

const message = computed(
  () => MESSAGES[props.kind] || { eyebrow: 'REPORT UNAVAILABLE', title: '报告加载失败', detail: '请稍后重试。', visual: 'service' },
)
const retryable = computed(
  () =>
    props.kind === ERROR_KINDS.UNAVAILABLE ||
    props.kind === ERROR_KINDS.NETWORK ||
    props.kind === ERROR_KINDS.NOT_READY ||
    !MESSAGES[props.kind],
)

function retry() {
  globalThis.location?.reload()
}
</script>

<template>
  <main class="app-shell report-error-page" :data-error-kind="kind" data-testid="report-error">
    <header class="report-error-brand" aria-label="长寿指数报告">
      <span class="report-error-brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span>长寿指数报告</span>
    </header>
    <section class="error-state" :role="loading ? undefined : 'alert'" aria-live="polite">
      <template v-if="loading">
        <span class="error-eyebrow">LOADING</span>
        <h1 id="errorTitle">正在加载报告…</h1>
      </template>
      <template v-else>
        <div class="report-error-art" :data-visual="message.visual" aria-hidden="true">
          <svg viewBox="0 0 280 250" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="errorHalo" x1="45" y1="25" x2="235" y2="230" gradientUnits="userSpaceOnUse">
                <stop stop-color="#EAF4FF" />
                <stop offset="1" stop-color="#DCEBFA" />
              </linearGradient>
              <linearGradient id="errorCard" x1="77" y1="65" x2="204" y2="215" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FFFFFF" />
                <stop offset="1" stop-color="#F6FAFF" />
              </linearGradient>
            </defs>
            <circle cx="140" cy="122" r="103" fill="url(#errorHalo)" />
            <circle cx="140" cy="122" r="87" stroke="#C7DDF5" stroke-dasharray="3 7" />
            <circle cx="39" cy="93" r="5" fill="#B9D7F3" />
            <circle cx="237" cy="166" r="7" fill="#C7E4EC" />
            <path d="M53 167l3.5 3.5L60 167l-3.5-3.5L53 167Z" fill="#B4CFF1" />
            <rect x="76" y="62" width="128" height="152" rx="21" fill="url(#errorCard)" stroke="#CADCF0" stroke-width="1.5" />
            <rect x="94" y="82" width="49" height="8" rx="4" fill="#C3D9F2" />
            <rect x="94" y="97" width="78" height="6" rx="3" fill="#E3EDF8" />
            <circle cx="140" cy="144" r="37" fill="#EBF4FF" stroke="#D7E7F7" />
            <template v-if="message.visual === 'network'">
              <path d="M117 139c13-12 33-12 46 0M126 149c8-7 20-7 28 0" stroke="#507BBB" stroke-width="4.5" stroke-linecap="round" />
              <circle cx="140" cy="158" r="3.5" fill="#507BBB" />
              <path d="m112 165 57-55" stroke="#EBF4FF" stroke-width="10" stroke-linecap="round" />
              <path d="m113 164 55-53" stroke="#D47C83" stroke-width="4.5" stroke-linecap="round" />
            </template>
            <template v-else-if="message.visual === 'progress'">
              <circle cx="140" cy="144" r="22" stroke="#507BBB" stroke-width="4" />
              <path d="M140 130v15l10 7" stroke="#507BBB" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            </template>
            <template v-else-if="message.visual === 'service'">
              <rect x="120" y="125" width="40" height="14" rx="4" stroke="#507BBB" stroke-width="3" />
              <rect x="120" y="147" width="40" height="14" rx="4" stroke="#507BBB" stroke-width="3" />
              <circle cx="128" cy="132" r="2" fill="#507BBB" />
              <circle cx="128" cy="154" r="2" fill="#507BBB" />
              <path d="M139 132h13M139 154h13" stroke="#9BB9DD" stroke-width="3" stroke-linecap="round" />
            </template>
            <template v-else-if="message.visual === 'route'">
              <circle cx="140" cy="144" r="22" stroke="#507BBB" stroke-width="3" />
              <path d="m149 135-5 13-13 5 5-13 13-5Z" fill="#507BBB" />
            </template>
            <template v-else>
              <path d="M132 132a10 10 0 1 1 16 8c-5 4-8 6-8 10" stroke="#507BBB" stroke-width="5" stroke-linecap="round" />
              <circle cx="140" cy="161" r="3" fill="#507BBB" />
            </template>
            <rect x="95" y="190" width="90" height="5" rx="2.5" fill="#DFEAF7" />
            <rect x="95" y="200" width="65" height="5" rx="2.5" fill="#E9F1FA" />
          </svg>
        </div>
        <span class="error-eyebrow">{{ message.eyebrow }}</span>
        <h1 id="errorTitle">{{ message.title }}</h1>
        <p>{{ message.detail }}</p>
        <button v-if="retryable" type="button" class="report-error-retry" @click="retry">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 8a8 8 0 1 0 .2 7M20 4v4h-4" /></svg>
          <span>{{ kind === ERROR_KINDS.NOT_READY ? '刷新状态' : '重新加载' }}</span>
        </button>
        <RouterLink v-else-if="backTo" class="report-error-retry" :to="backTo">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12" /></svg>
          <span>{{ backLabel }}</span>
        </RouterLink>
        <RouterLink v-if="retryable && backTo" class="report-error-secondary" :to="backTo">{{ backLabel }}</RouterLink>
        <span v-if="message.hint" class="report-error-hint">{{ message.hint }}</span>
      </template>
    </section>
  </main>
</template>

<style scoped>
.report-error-page {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  padding: 0 24px 32px;
  background: radial-gradient(circle at 50% 32%, #fff 0, #f6faff 44%, #eef5fc 100%);
}

.report-error-page::before {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(#bdd3eb 0.6px, transparent 0.6px);
  background-size: 19px 19px;
  opacity: .18;
  pointer-events: none;
  content: '';
}

.report-error-brand,
.error-state { position: relative; z-index: 1; }

.report-error-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 72px;
  color: #526b90;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .04em;
}

.report-error-brand-mark {
  display: grid;
  grid-template-columns: repeat(2, 5px);
  gap: 3px;
  transform: rotate(-12deg);
}

.report-error-brand-mark i { width: 5px; height: 5px; border-radius: 2px; background: #4b78bc; }
.report-error-brand-mark i:last-child { background: #87b5d7; }

.error-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: min(100%, 400px);
  margin: 0 auto;
  padding: 0 0 46px;
  text-align: center;
}

.report-error-art { width: min(100%, 280px); margin: 0 0 10px; }
.report-error-art svg { display: block; width: 100%; height: auto; stroke: none; }
.error-eyebrow { color: #5b83b8; font: 700 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .16em; }
.error-state h1 { margin: 12px 0 0; color: #1d3150; font-size: 28px; line-height: 1.25; letter-spacing: .02em; }
.error-state p { max-width: 290px; margin: 13px 0 0; color: #6a7b92; font-size: 14px; line-height: 1.75; }

.report-error-retry {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: min(100%, 272px);
  min-height: 50px;
  margin-top: 32px;
  border: 0;
  border-radius: 15px;
  color: #fff;
  background: #426fc0;
  box-shadow: 0 10px 24px rgba(66, 111, 192, .2);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.report-error-retry:active { transform: translateY(1px); box-shadow: 0 5px 12px rgba(66, 111, 192, .2); }
.report-error-retry:focus-visible { outline: 3px solid #8db4ef; outline-offset: 3px; }
.report-error-retry svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2; fill: none; }
.report-error-secondary { margin-top: 18px; color: #4f75ac; font-size: 13px; font-weight: 600; }
.report-error-secondary:focus-visible { outline: 2px solid #8db4ef; outline-offset: 4px; }
.report-error-hint { margin-top: 18px; color: #96a5b8; font-size: 11px; line-height: 1.5; }

@media (max-height: 640px) {
  .report-error-brand { min-height: 58px; }
  .report-error-art { width: min(100%, 215px); }
  .error-state { padding-bottom: 16px; }
  .report-error-retry { margin-top: 22px; }
}
</style>
