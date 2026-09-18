import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useScoreAnimation(target, duration = 1450) {
  const displayScore = ref(0)
  let frame = 0

  const prefersReducedMotion = () => typeof window === 'undefined'
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  function run() {
    cancelAnimationFrame(frame)
    const finalScore = Number(target) || 0
    if (prefersReducedMotion()) {
      displayScore.value = finalScore
      return
    }
    displayScore.value = 0
    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      displayScore.value = Math.round(finalScore * (1 - Math.pow(1 - progress, 4)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  onMounted(run)
  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return { displayScore, run }
}
