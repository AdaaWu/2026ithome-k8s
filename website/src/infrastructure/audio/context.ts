// 音樂與音效共用的 AudioContext：第一次用到才建立，使用者手勢時恢復

let ctx: AudioContext | null = null
let listening = false

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const

/** iOS 來電或切換音訊路由會進入 interrupted，也要恢復 */
export function needsResume(c: BaseAudioContext) {
  const state: string = c.state
  return state !== 'running' && state !== 'closed'
}

function resumeOnGesture() {
  if (ctx && needsResume(ctx)) void ctx.resume().catch(() => {})
}

function listenGestures() {
  if (listening || typeof window === 'undefined') return
  listening = true
  GESTURES.forEach((type) => window.addEventListener(type, resumeOnGesture, { capture: true, passive: true }))
}

/** 不支援 WebAudio 時回傳 null，呼叫端靜默略過 */
export function getAudioContext(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  try {
    ctx = new AudioContext()
  } catch {
    return null
  }
  listenGestures()
  return ctx
}
