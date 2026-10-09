// 音色與主輸出鏈：用基本振盪器疊出水彩繪本感的溫暖音色
import type { Instrument } from './score'

type Ctx = BaseAudioContext
type Rand = () => number

const MASTER_GAIN = 0.18
const TONE_CUTOFF = 4200
const REVERB_SECONDS = 2.6
const REVERB_WET = 0.26
const SILENT = 0.0001

const impulses = new WeakMap<Ctx, AudioBuffer>()

/** 程式產生的衰減雜訊殘響，越後段越暗；同一個 context 共用一份 */
export function getImpulse(ctx: Ctx): AudioBuffer {
  const cached = impulses.get(ctx)
  if (cached) return cached
  const length = Math.floor(ctx.sampleRate * REVERB_SECONDS)
  const preDelay = Math.floor(ctx.sampleRate * 0.012)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    let smooth = 0
    for (let i = preDelay; i < length; i++) {
      const t = i / length
      smooth += (Math.random() * 2 - 1 - smooth) * (0.5 - 0.4 * t)
      data[i] = smooth * Math.pow(1 - t, 3)
    }
  }
  impulses.set(ctx, buffer)
  return buffer
}

export interface MusicChain {
  /** 各曲子的匯流排接到這裡 */
  input: AudioNode
  /** 音效壓低音樂用 */
  duck: GainNode
  /** 全站唯一的殘響，音效也送進這裡 */
  reverb: AudioNode
}

/** 樂器 → 低通 → 乾聲＋殘響 → 壓縮 → 壓低 → 主音量 */
export function createMusicChain(ctx: Ctx, destination: AudioNode): MusicChain {
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = TONE_CUTOFF
  tone.Q.value = 0.5

  const dry = ctx.createGain()
  dry.gain.value = 1 - REVERB_WET
  const send = ctx.createGain()
  send.gain.value = REVERB_WET
  const verb = ctx.createConvolver()
  verb.buffer = getImpulse(ctx)

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 12
  comp.ratio.value = 3
  comp.attack.value = 0.012
  comp.release.value = 0.25

  const duck = ctx.createGain()
  const master = ctx.createGain()
  master.gain.value = MASTER_GAIN

  tone.connect(dry).connect(comp)
  tone.connect(send).connect(verb).connect(comp)
  comp.connect(duck).connect(master).connect(destination)
  return { input: tone, duck, reverb: verb }
}

export function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

const cents = (c: number) => Math.pow(2, c / 1200)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 一個音用到的所有節點，最後一個聲源結束時一起斷開 */
class Voice {
  private nodes: AudioNode[] = []
  private last: AudioScheduledSourceNode | null = null
  private lastStop = -Infinity

  readonly ctx: Ctx

  constructor(ctx: Ctx) {
    this.ctx = ctx
  }

  private keep<T extends AudioNode>(node: T): T {
    this.nodes.push(node)
    return node
  }

  private source<T extends AudioScheduledSourceNode>(node: T, start: number, stop: number): T {
    node.start(start)
    node.stop(stop)
    if (stop > this.lastStop) {
      this.lastStop = stop
      this.last = node
    }
    return this.keep(node)
  }

  osc(type: OscillatorType, freq: number, out: AudioNode, start: number, stop: number) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.connect(out)
    return this.source(o, start, stop)
  }

  noise(buffer: AudioBuffer, out: AudioNode, start: number, stop: number) {
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(out)
    return this.source(src, start, stop)
  }

  gain(out: AudioNode, value = 0) {
    const g = this.keep(this.ctx.createGain())
    g.gain.value = value
    g.connect(out)
    return g
  }

  /** 調變用：把訊號乘上 depth 後加到參數上 */
  mod(param: AudioParam, depth: number) {
    const g = this.keep(this.ctx.createGain())
    g.gain.value = depth
    g.connect(param)
    return g
  }

  filter(type: BiquadFilterType, out: AudioNode, freq: number, q = 0.5) {
    const f = this.keep(this.ctx.createBiquadFilter())
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    f.connect(out)
    return f
  }

  release() {
    const { nodes, last } = this
    if (last) last.onended = () => nodes.forEach((n) => n.disconnect())
  }
}

/** 快起音後指數衰減到無聲 */
function pluck(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(SILENT, t + attack + decay)
}

type VoiceFn = (v: Voice, out: AudioNode, t: number, f: number, dur: number, vel: number, rand: Rand) => void

// 非整數倍泛音帶出金屬感，高音衰減較短
const musicBox: VoiceFn = (v, out, t, f, _dur, vel, rand) => {
  const decay = clamp(2.5 - Math.log2(f / 262) * 0.5, 1.5, 2.5)
  const detune = cents((rand() * 2 - 1) * 3)
  const partials = [
    { ratio: 1, level: 1, life: 1 },
    { ratio: 3, level: 0.16, life: 0.35 },
    { ratio: 5.4, level: 0.07, life: 0.18 },
  ]
  for (const p of partials) {
    const g = v.gain(out)
    pluck(g, t, 1.5 * vel * p.level, 0.003, decay * p.life)
    v.osc('sine', f * p.ratio * detune, g, t, t + decay * p.life + 0.05)
  }
}

const noises = new WeakMap<Ctx, AudioBuffer>()

/** 短白雜訊片段，同一個 context 共用 */
function getNoise(ctx: Ctx): AudioBuffer {
  const cached = noises.get(ctx)
  if (cached) return cached
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  noises.set(ctx, buffer)
  return buffer
}

// 三角波加正弦，低通隨衰減變暗，力度越大越亮；起音帶一小口帶通雜訊當毛氈槌的氣音
const felt: VoiceFn = (v, out, t, f, dur, vel) => {
  const life = clamp(dur + 0.4, 1, 2)
  const g = v.gain(out)
  const cutoff = 1500 + 1000 * vel
  const filter = v.filter('lowpass', g, cutoff, 0.3)
  filter.frequency.setValueAtTime(cutoff, t)
  filter.frequency.exponentialRampToValueAtTime(cutoff * 0.45, t + life)
  pluck(g, t, 1.6 * vel, 0.015, life)
  v.osc('triangle', f, filter, t, t + life + 0.05)
  v.osc('sine', f, v.gain(filter, 0.6), t, t + life + 0.05)

  const breath = v.gain(out)
  pluck(breath, t, 0.12 * vel, 0.002, 0.03)
  v.noise(getNoise(v.ctx), v.filter('bandpass', breath, clamp(f * 4, 1200, 3500), 0.9), t, t + 0.04)
}

// 三個微走音的振盪器經低通，慢 LFO 推動濾波並乘在音量上做出呼吸感
const pad: VoiceFn = (v, out, t, f, dur, vel, rand) => {
  // 長和弦（超過 6 秒）起音放慢到最多 3 秒，其餘維持 0.8–1.5 秒
  const attack = dur > 6 ? Math.min(3, dur * 0.4) : clamp(dur * 0.5, 0.8, 1.5)
  const release = 1.5
  const end = t + Math.max(dur, attack) + release
  const peak = 0.42 * vel

  const g = v.gain(out)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.setValueAtTime(peak, t + Math.max(dur, attack))
  g.gain.linearRampToValueAtTime(0, end)

  const breathe = v.gain(g, 1)
  const filter = v.filter('lowpass', breathe, 1000, 0.7)
  const lfo = v.osc('sine', 0.15 + rand() * 0.1, v.mod(filter.frequency, 220), t, end)
  lfo.connect(v.mod(breathe.gain, 0.2))

  v.osc('sawtooth', f * cents(-7), v.gain(filter, 0.5), t, end)
  v.osc('sawtooth', f * cents(7), v.gain(filter, 0.5), t, end)
  v.osc('triangle', f, filter, t, end)
}

const bass: VoiceFn = (v, out, t, f, dur, vel) => {
  const life = Math.min(dur, 0.8) + 0.15
  const g = v.gain(out)
  pluck(g, t, 2.4 * vel, 0.02, life)
  const filter = v.filter('lowpass', g, 400, 0.4)
  v.osc('sine', f, filter, t, t + life + 0.05)
  v.osc('triangle', f, v.gain(filter, 0.2), t, t + life + 0.05)
}

const chime: VoiceFn = (v, out, t, f, _dur, vel) => {
  const partials = [
    { ratio: 1, level: 1, life: 3.5 },
    { ratio: 2.76, level: 0.3, life: 1.2 },
  ]
  for (const p of partials) {
    const g = v.gain(out)
    pluck(g, t, 0.75 * vel * p.level, 0.002, p.life)
    v.osc('sine', f * p.ratio, g, t, t + p.life + 0.05)
  }
}

const VOICES: Record<Instrument, VoiceFn> = { musicBox, felt, pad, bass, chime }

/** 在 time 秒排一個音，dur 以秒計 */
export function playNote(
  ctx: Ctx,
  out: AudioNode,
  instrument: Instrument,
  time: number,
  midi: number,
  dur: number,
  vel: number,
  rand: Rand = Math.random,
) {
  const voice = new Voice(ctx)
  VOICES[instrument](voice, out, time, midiToFreq(midi), dur, vel, rand)
  voice.release()
}
