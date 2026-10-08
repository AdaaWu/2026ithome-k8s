import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import type { Tone } from './types'

// 全域規則：HintBubble 一句 25 字內
const MAX_CHARS = 25

/** 提示氣泡的狀態；新的 show 會取代舊的並重新計時 */
export function useHint(defaultMs = 2200) {
  const text = ref<string | null>(null)
  const tone = ref<Tone>('info')
  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    clearTimeout(timer)
    timer = undefined
    text.value = null
  }

  function show(message: string, nextTone: Tone = 'info', ms = defaultMs) {
    if (import.meta.env.DEV && message.length > MAX_CHARS) console.warn(`[useHint] 超過 ${MAX_CHARS} 字：${message}`)
    clear()
    text.value = message
    tone.value = nextTone
    timer = setTimeout(clear, ms)
  }

  if (getCurrentScope()) onScopeDispose(clear)

  return { text: text as Readonly<Ref<string | null>>, tone: tone as Readonly<Ref<Tone>>, show, clear }
}
