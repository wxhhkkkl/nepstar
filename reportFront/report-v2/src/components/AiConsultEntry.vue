<script setup>
import { ref } from 'vue'

defineProps({
  href: { type: String, required: true },
  avatar: { type: String, required: true },
})
const failed = ref(false)
</script>

<template>
  <a class="ai-consult-entry" :href="href" aria-label="进入 AI 长寿咨询" data-testid="ai-consult-entry">
    <span class="ai-entry-icon"><img :src="avatar" alt="AI 长寿顾问卡通医生头像" width="42" height="42" @error="failed = true"></span>
    <span class="ai-entry-copy"><small>LONGEVITY AI</small><strong>{{ failed ? 'AI 咨询入口' : 'AI 长寿咨询' }}</strong></span>
    <svg class="ai-entry-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
  </a>
</template>
