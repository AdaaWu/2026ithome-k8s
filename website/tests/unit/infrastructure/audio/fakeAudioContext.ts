// 最小的 AudioContext 替身：只記錄呼叫，不產生聲音
import { vi } from 'vitest'

type ParamEvent = [kind: string, value: number, time: number]

export class FakeParam {
  events: ParamEvent[] = []
  constructor(public value = 0) {}
  setValueAtTime(v: number, t: number) {
    this.events.push(['set', v, t])
    return this
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(['linear', v, t])
    return this
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.events.push(['exp', v, t])
    return this
  }
  setTargetAtTime(v: number, t: number) {
    this.events.push(['target', v, t])
    return this
  }
  cancelScheduledValues(t: number) {
    this.events.push(['cancel', 0, t])
    return this
  }
}

export class FakeNode {
  connections: unknown[] = []
  disconnected = false
  connect<T>(node: T): T {
    this.connections.push(node)
    return node
  }
  disconnect() {
    this.disconnected = true
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1)
}

export class FakeOscillator extends FakeNode {
  onended: (() => void) | null = null
  type = 'sine'
  frequency = new FakeParam(440)
  detune = new FakeParam(0)
  startAt = -1
  stopAt = -1
  start(t = 0) {
    this.startAt = t
  }
  stop(t = 0) {
    this.stopAt = t
  }
}

export class FakeAudioContext {
  currentTime = 0
  sampleRate = 8000
  /** 可設成 'interrupted' 模擬 iOS 中斷 */
  state: string = 'running'
  destination = new FakeNode()
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  convolvers: FakeNode[] = []
  /** 除了 destination 以外建立過的所有節點 */
  nodes: FakeNode[] = []

  private track<T extends FakeNode>(node: T): T {
    this.nodes.push(node)
    return node
  }

  resume = vi.fn(async () => {
    this.state = 'running'
  })
  suspend = vi.fn(async () => {
    this.state = 'suspended'
  })

  createOscillator() {
    const o = this.track(new FakeOscillator())
    this.oscillators.push(o)
    return o
  }
  createGain() {
    const g = this.track(new FakeGain())
    this.gains.push(g)
    return g
  }
  createBufferSource() {
    const src = this.track(Object.assign(new FakeOscillator(), { buffer: null as unknown }))
    this.oscillators.push(src)
    return src
  }
  createConstantSource() {
    const src = this.track(Object.assign(new FakeOscillator(), { offset: new FakeParam(1) }))
    this.oscillators.push(src)
    return src
  }
  createBiquadFilter() {
    return this.track(Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1) }))
  }
  createConvolver() {
    const c = this.track(Object.assign(new FakeNode(), { buffer: null as unknown, normalize: true }))
    this.convolvers.push(c)
    return c
  }
  createDynamicsCompressor() {
    return this.track(Object.assign(new FakeNode(), {
      threshold: new FakeParam(),
      knee: new FakeParam(),
      ratio: new FakeParam(),
      attack: new FakeParam(),
      release: new FakeParam(),
    }))
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (i: number) => data[i] }
  }
}

/** 轉成引擎要的型別，測試裡用 FakeAudioContext 的欄位檢查 */
export const asContext = (fake: FakeAudioContext) => fake as unknown as AudioContext
