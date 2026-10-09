import { describe, expect, it } from 'vitest'
import type { Instrument } from '@/infrastructure/audio/score'
import { createMusicChain, midiToFreq, playNote } from '@/infrastructure/audio/voices'
import { asContext, FakeAudioContext } from './fakeAudioContext'

const INSTRUMENTS: Instrument[] = ['musicBox', 'felt', 'pad', 'bass', 'chime']

describe('voices 音色', () => {
  it('MIDI 69 是 440Hz', () => {
    expect(midiToFreq(69)).toBe(440)
    expect(midiToFreq(81)).toBeCloseTo(880)
  })

  it.each(INSTRUMENTS)('%s 在指定時間起音，並在之後停止', (instrument) => {
    const ctx = new FakeAudioContext()
    playNote(asContext(ctx), asContext(ctx).destination, instrument, 1, 60, 1, 0.7, () => 0.5)
    const sounding = ctx.oscillators.filter((o) => o.frequency.value > 20)
    expect(sounding.length).toBeGreaterThan(0)
    sounding.forEach((o) => {
      expect(o.startAt).toBe(1)
      expect(o.stopAt).toBeGreaterThan(1)
    })
  })

  it('felt 起音帶一小口短促的氣音', () => {
    const ctx = new FakeAudioContext()
    playNote(asContext(ctx), asContext(ctx).destination, 'felt', 1, 60, 1, 0.7)
    const breath = ctx.oscillators.find((o) => 'buffer' in o)
    expect(breath?.stopAt).toBeCloseTo(1.04)
  })

  it.each(INSTRUMENTS)('%s 在最後一個聲源結束時斷開所有節點', (instrument) => {
    const ctx = new FakeAudioContext()
    playNote(asContext(ctx), asContext(ctx).destination, instrument, 0, 60, 8, 0.7, () => 0.5)
    const last = ctx.oscillators.reduce((a, b) => (b.stopAt > a.stopAt ? b : a))
    expect(last.onended).toBeTypeOf('function')
    expect(ctx.oscillators.filter((o) => o.onended)).toEqual([last])
    last.onended!()
    expect(ctx.nodes.filter((n) => !n.disconnected)).toEqual([])
  })

  it('長和弦的 pad 起音放慢到最多 3 秒', () => {
    const ctx = new FakeAudioContext()
    playNote(asContext(ctx), asContext(ctx).destination, 'pad', 0, 60, 8, 0.7)
    const env = ctx.gains.find((g) => g.gain.events[0]?.[0] === 'set' && g.gain.events[1]?.[0] === 'linear')!
    expect(env.gain.events[1][2]).toBe(3)
  })

  it('主輸出鏈帶殘響與主音量', () => {
    const ctx = new FakeAudioContext()
    createMusicChain(asContext(ctx), asContext(ctx).destination)
    expect(ctx.gains.some((g) => g.gain.value === 0.18)).toBe(true)
  })
})
