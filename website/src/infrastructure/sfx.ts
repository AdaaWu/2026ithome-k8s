// WebAudio 合成的短音效，不需要任何音檔
import { duckMusic, reverbInput } from './audio/bgm'
import { getAudioContext, needsResume } from './audio/context'

export type SfxName = 'tap' | 'pop' | 'correct' | 'wrong' | 'win' | 'unlock'

const MUTE_KEY = 'k8s-cloud-island-muted'
const SILENT = 0.0001

let muted = readMuted()
let bus: AudioNode | null = null

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

/** 音效共用的柔和低通，並送一點與音樂同一顆殘響 */
function sfxBus(ctx: AudioContext) {
  if (bus) return bus
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 5000
  tone.connect(ctx.destination)
  const verb = reverbInput()
  if (verb) {
    // 殘響回來會經過音樂主音量，送多一點補回
    const send = ctx.createGain()
    send.gain.value = 1.2
    tone.connect(send).connect(verb)
  }
  bus = tone
  return bus
}

interface ToneOptions {
  /** 從這個頻率滑到目標音高 */
  from?: number
  /** 疊一點 ×3 泛音，帶出音樂盒的亮度 */
  bell?: boolean
}

// 正弦為主、少量三角波補厚度，柔和起音後指數衰減
function tone(ctx: AudioContext, freq: number, start: number, duration: number, gain = 0.12, opts: ToneOptions = {}) {
  const t = ctx.currentTime + start
  const vol = ctx.createGain()
  vol.gain.setValueAtTime(0, t)
  vol.gain.linearRampToValueAtTime(gain, t + 0.006)
  vol.gain.exponentialRampToValueAtTime(SILENT, t + duration)
  vol.connect(sfxBus(ctx))

  const layers: [OscillatorType, number, number][] = [
    ['sine', 1, 1],
    ['triangle', 1, 0.3],
  ]
  if (opts.bell) layers.push(['sine', 3, 0.12])
  const nodes: AudioNode[] = [vol]
  layers.forEach(([type, ratio, level], i) => {
    const osc = ctx.createOscillator()
    const mix = ctx.createGain()
    nodes.push(osc, mix)
    osc.type = type
    osc.frequency.setValueAtTime((opts.from ?? freq) * ratio, t)
    if (opts.from) osc.frequency.exponentialRampToValueAtTime(freq * ratio, t + Math.min(0.06, duration))
    mix.gain.value = level
    osc.connect(mix).connect(vol)
    osc.start(t)
    osc.stop(t + duration + 0.02)
    // 每層同時停止，最後一層結束時釋放這個音的所有節點
    if (i === layers.length - 1) osc.onended = () => nodes.forEach((n) => n.disconnect())
  })
}

const RECIPES: Record<SfxName, (ctx: AudioContext) => void> = {
  tap: (c) => tone(c, 660, 0, 0.09, 0.07),
  pop: (c) => tone(c, 880, 0, 0.12, 0.12, { from: 560 }),
  correct: (c) => [523, 659, 784].forEach((f, i) => tone(c, f, i * 0.07, 0.3, 0.13, { bell: true })),
  wrong: (c) => [233, 196].forEach((f, i) => tone(c, f, i * 0.11, 0.24, 0.12, { from: f * 1.06 })),
  unlock: (c) => [659, 784, 988, 1319].forEach((f, i) => tone(c, f, i * 0.08, 0.4, 0.11, { bell: true })),
  win: (c) => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(c, f, i * 0.11, 0.45, 0.12, { bell: true })),
}

export function playSfx(name: SfxName) {
  if (muted || (typeof document !== 'undefined' && document.hidden)) return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    if (needsResume(ctx)) ctx.resume().catch(() => {})
    // tap 太頻繁，壓低會讓音樂忽大忽小
    if (name !== 'tap') duckMusic()
    RECIPES[name](ctx)
  } catch {
    // 音效失敗不影響遊戲
  }
}
