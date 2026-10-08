// WebAudio 合成的短音效，不需要任何音檔
export type SfxName = 'tap' | 'pop' | 'correct' | 'wrong' | 'win' | 'unlock'

const MUTE_KEY = 'k8s-cloud-island-muted'

let ctx: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function isMuted() {
  return muted
}

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // 無法寫入時只在本次生效
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.12) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const vol = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
  vol.gain.setValueAtTime(gain, ctx.currentTime + start)
  vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)
  osc.connect(vol).connect(ctx.destination)
  osc.start(ctx.currentTime + start)
  osc.stop(ctx.currentTime + start + duration + 0.02)
}

const RECIPES: Record<SfxName, () => void> = {
  tap: () => tone(660, 0, 0.06, 'triangle', 0.06),
  pop: () => tone(880, 0, 0.08, 'sine', 0.1),
  correct: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.16, 'triangle')),
  wrong: () => tone(196, 0, 0.22, 'sawtooth', 0.05),
  unlock: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.08, 0.2, 'triangle')),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.24, 'triangle')),
}

export function playSfx(name: SfxName) {
  if (muted || typeof window === 'undefined' || !('AudioContext' in window)) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    RECIPES[name]()
  } catch {
    // 音效失敗不影響遊戲
  }
}
