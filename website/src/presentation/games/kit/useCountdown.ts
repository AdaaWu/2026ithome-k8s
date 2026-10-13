import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useGamePaused } from './useGamePaused'

const STEP_MS = 100

/** 倒數計時；remaining 以 0.1 秒遞減，給計時條平滑顯示；遊戲暫停時停止遞減 */
export function useCountdown(totalSec: number, opts: { onExpire?: () => void } = {}) {
  const remaining = ref(totalSec)
  const running = ref(false)
  const paused = useGamePaused()
  let timer: ReturnType<typeof setInterval> | undefined

  function arm() {
    timer = setInterval(() => {
      remaining.value = Math.max(0, Math.round((remaining.value - STEP_MS / 1000) * 10) / 10)
      if (remaining.value === 0) {
        pause()
        opts.onExpire?.()
      }
    }, STEP_MS)
  }

  function disarm() {
    clearInterval(timer)
    timer = undefined
  }

  function pause() {
    disarm()
    running.value = false
  }

  function start() {
    if (running.value || remaining.value <= 0) return
    running.value = true
    if (!paused.value) arm()
  }

  function reset(sec = totalSec) {
    pause()
    remaining.value = sec
  }

  watch(
    paused,
    (isPaused) => {
      if (!running.value) return
      if (isPaused) disarm()
      else if (!timer) arm()
    },
    { flush: 'sync' },
  )

  if (getCurrentScope()) onScopeDispose(pause)

  return {
    remaining: remaining as Readonly<Ref<number>>,
    running: running as Readonly<Ref<boolean>>,
    start,
    pause,
    reset,
  }
}
