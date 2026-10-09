import { onScopeDispose } from 'vue'

/** 集中管理延遲回呼：retry 時呼叫 clearAll，避免上一局的回呼改到新局 */
export function useTimeouts() {
  const pending = new Set<ReturnType<typeof setTimeout>>()

  function later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      pending.delete(id)
      fn()
    }, ms)
    pending.add(id)
  }

  function clearAll() {
    pending.forEach(clearTimeout)
    pending.clear()
  }

  onScopeDispose(clearAll)
  return { later, clearAll }
}
