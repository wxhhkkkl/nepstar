<script setup>
import { onBeforeUnmount, ref } from 'vue'

defineProps({ href: { type: String, required: true } })
const saved = ref(false)
const failed = ref(false)
let timer

function handleSave() {
  clearTimeout(timer)
  saved.value = true
  failed.value = false
  timer = setTimeout(() => { saved.value = false }, 1800)
}

function handleFailure() {
  failed.value = true
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <a id="saveReport" class="save-report-button" :class="{ 'is-saved': saved }" :href="href" download="长寿指数报告V2_手机长图.png" aria-label="保存长寿指数报告长图" @click="handleSave">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 18v2h14v-2" /></svg>
    <span>{{ saved ? '已保存' : '保存报告' }}</span>
  </a>
  <div id="saveToast" class="save-toast" :class="{ 'is-showing': saved || failed }" role="status" aria-live="polite"><i></i><span>{{ failed ? '暂时无法保存，请长按图片保存' : '报告长图已保存' }}</span></div>
  <img class="asset-probe" :src="href" alt="" aria-hidden="true" @error="handleFailure">
</template>
