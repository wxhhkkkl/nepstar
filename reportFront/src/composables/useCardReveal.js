import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useCardReveal() {
  const element = ref(null)
  const isVisible = ref(false)
  let observer

  onMounted(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const target = element.value?.$el ?? element.value
    if (reduced || !('IntersectionObserver' in window) || !target) {
      isVisible.value = true
      return
    }
    document.documentElement.classList.add('motion-ready')
    observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      isVisible.value = true
      observer.disconnect()
    }, { threshold: 0.22, rootMargin: '0px 0px -8% 0px' })
    observer.observe(target)
  })

  onBeforeUnmount(() => observer?.disconnect())
  return { element, isVisible }
}
