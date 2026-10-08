import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

/** 固定節拍的模擬迴圈；每次 start 從第 1 拍重新計數 */
export function useTicker(intervalMs: number, onTick: (tickCount: number) => void) {
  const running = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined
  let count = 0

  function stop() {
    clearInterval(timer)
    timer = undefined
    running.value = false
  }

  function start() {
    stop()
    count = 0
    running.value = true
    timer = setInterval(() => onTick(++count), intervalMs)
  }

  if (getCurrentScope()) onScopeDispose(stop)

  return { running: running as Readonly<Ref<boolean>>, start, stop }
}
