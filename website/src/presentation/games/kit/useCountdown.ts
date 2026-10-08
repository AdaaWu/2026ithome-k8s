import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

const STEP_MS = 100

/** 倒數計時；remaining 以 0.1 秒遞減，給計時條平滑顯示 */
export function useCountdown(totalSec: number, opts: { onExpire?: () => void } = {}) {
  const remaining = ref(totalSec)
  const running = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined

  function pause() {
    clearInterval(timer)
    timer = undefined
    running.value = false
  }

  function start() {
    if (running.value || remaining.value <= 0) return
    running.value = true
    timer = setInterval(() => {
      remaining.value = Math.max(0, Math.round((remaining.value - STEP_MS / 1000) * 10) / 10)
      if (remaining.value === 0) {
        pause()
        opts.onExpire?.()
      }
    }, STEP_MS)
  }

  function reset(sec = totalSec) {
    pause()
    remaining.value = sec
  }

  if (getCurrentScope()) onScopeDispose(pause)

  return {
    remaining: remaining as Readonly<Ref<number>>,
    running: running as Readonly<Ref<boolean>>,
    start,
    pause,
    reset,
  }
}
