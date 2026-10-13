import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useGamePaused } from './useGamePaused'

/** 固定節拍的模擬迴圈；每次 start 從第 1 拍重新計數，遊戲暫停時停拍並保留這一拍已走的時間 */
export function useTicker(intervalMs: number, onTick: (tickCount: number) => void) {
  const running = ref(false)
  const paused = useGamePaused()
  let timer: ReturnType<typeof setTimeout> | undefined
  let count = 0
  let tickStartedAt = 0
  let elapsedInTick = 0

  function schedule(delay: number) {
    tickStartedAt = Date.now() - (intervalMs - delay)
    timer = setTimeout(() => {
      timer = undefined
      tickStartedAt = Date.now()
      onTick(++count)
      // onTick 內可能已 stop 或重新 start
      if (running.value && !timer && !paused.value) schedule(intervalMs)
    }, delay)
  }

  function stop() {
    clearTimeout(timer)
    timer = undefined
    running.value = false
    elapsedInTick = 0
  }

  function start() {
    stop()
    count = 0
    running.value = true
    if (!paused.value) schedule(intervalMs)
  }

  watch(
    paused,
    (isPaused) => {
      if (!running.value) return
      if (isPaused) {
        elapsedInTick = Math.min(intervalMs, Date.now() - tickStartedAt)
        clearTimeout(timer)
        timer = undefined
      } else if (!timer) {
        schedule(intervalMs - elapsedInTick)
        elapsedInTick = 0
      }
    },
    { flush: 'sync' },
  )

  if (getCurrentScope()) onScopeDispose(stop)

  return { running: running as Readonly<Ref<boolean>>, start, stop }
}
