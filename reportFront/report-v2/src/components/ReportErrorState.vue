<script setup>
import { computed } from 'vue'
import { ERROR_KINDS } from '@/api/reportClient.js'

const props = defineProps({
  kind: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})

// 四种失败状态各自的文案。注意"报告不存在"与"无权访问"后端对外合并，
// 这里也就只有一种呈现（FR-019、SC-007）。
const MESSAGES = {
  [ERROR_KINDS.NOT_FOUND]: { title: '报告打不开', detail: '报告不存在，或这份报告不属于当前账户。' },
  [ERROR_KINDS.NOT_READY]: { title: '报告尚未生成完成', detail: '报告还在生成中，请稍后再试。' },
  [ERROR_KINDS.SYSTEM_NOT_FOUND]: { title: '该系统不属于此报告', detail: '请返回首页重新选择。' },
  [ERROR_KINDS.UNAVAILABLE]: { title: '报告服务暂时不可用', detail: '数据源暂时无法访问，请稍后重试。' },
  [ERROR_KINDS.NETWORK]: { title: '网络连接失败', detail: '请检查网络后重试。' },
}

const message = computed(
  () => MESSAGES[props.kind] || { title: '报告加载失败', detail: '请稍后重试。' },
)
const retryable = computed(
  () =>
    props.kind === ERROR_KINDS.UNAVAILABLE ||
    props.kind === ERROR_KINDS.NETWORK ||
    props.kind === ERROR_KINDS.NOT_READY,
)

function retry() {
  globalThis.location?.reload()
}
</script>

<template>
  <main class="app-shell report-v2" data-testid="report-error">
    <section class="error-state" :role="loading ? undefined : 'alert'" aria-live="polite">
      <template v-if="loading">
        <span class="eyebrow">LOADING</span>
        <h1 id="errorTitle">正在加载报告…</h1>
      </template>
      <template v-else>
        <span class="eyebrow">REPORT UNAVAILABLE</span>
        <h1 id="errorTitle">{{ message.title }}</h1>
        <p>{{ message.detail }}</p>
        <button v-if="retryable" type="button" class="replay-button" @click="retry">重试</button>
      </template>
    </section>
  </main>
</template>
