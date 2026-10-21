<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  title: { type: String, default: 'AI 长寿咨询' },
  to: { type: Object, required: true },
  avatar: { type: String, required: true },
})
const emit = defineEmits(['navigate'])
const failed = ref(false)
const compact = ref(false)
let expandTimer
let focused = false

function expand() {
  window.clearTimeout(expandTimer)
  compact.value = false
}

function onScroll() {
  if (focused) return
  compact.value = true
  window.clearTimeout(expandTimer)
  expandTimer = window.setTimeout(expand, 1000)
}

function onFocus() {
  focused = true
  expand()
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.clearTimeout(expandTimer)
})
</script>

<template>
  <RouterLink class="ai-consult-entry" :class="{ 'is-compact': compact }" :to="to" aria-label="进入 AI 长寿咨询" data-testid="ai-consult-entry" @click="emit('navigate')" @focus="onFocus" @blur="focused = false">
    <span class="ai-entry-icon"><img :src="avatar" alt="AI 长寿顾问卡通医生头像" width="40" height="40" @error="failed = true"></span>
    <span class="ai-entry-copy"><strong>{{ failed ? 'AI 咨询入口' : title }}</strong></span>
  </RouterLink>
</template>
