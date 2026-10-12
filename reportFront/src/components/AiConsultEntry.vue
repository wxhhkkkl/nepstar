<script setup>
import { ref } from 'vue'

defineProps({
  title: { type: String, default: 'AI 长寿咨询' },
  to: { type: Object, required: true },
  avatar: { type: String, required: true },
})
const emit = defineEmits(['navigate'])
const failed = ref(false)
</script>

<template>
  <RouterLink class="ai-consult-entry" :to="to" aria-label="进入 AI 长寿咨询" data-testid="ai-consult-entry" @click="emit('navigate')">
    <span class="ai-entry-icon"><img :src="avatar" alt="AI 长寿顾问卡通医生头像" width="42" height="42" @error="failed = true"></span>
    <span class="ai-entry-copy"><small>LONGEVITY AI</small><strong>{{ failed ? 'AI 咨询入口' : title }}</strong></span>
    <svg class="ai-entry-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
  </RouterLink>
</template>
