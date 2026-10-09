import { describe, expect, it } from 'vitest'
import {
  arpeggiate,
  bassLine,
  chordTrack,
  melody,
  noteToMidi,
  progression,
  voiceChord,
} from '@/infrastructure/audio/notation'

describe('noteToMidi', () => {
  it('中央 C 是 60，A4 是 69', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('A4')).toBe(69)
  })

  it('支援升降記號', () => {
    expect(noteToMidi('Bb3')).toBe(58)
    expect(noteToMidi('F#5')).toBe(78)
    expect(noteToMidi('Eb6')).toBe(87)
  })

  it('看不懂的音名直接拋錯', () => {
    expect(() => noteToMidi('H2')).toThrow()
    expect(() => noteToMidi('C')).toThrow()
  })
})

describe('melody', () => {
  it('依長度累加拍點，休止符只推進時間', () => {
    const notes = melody('C5:1 r:1 E5:2')
    expect(notes.map((n) => [n.beat, n.midi, n.dur])).toEqual([
      [0, 72, 1],
      [2, 76, 2],
    ])
  })

  it('可以指定起始拍', () => {
    expect(melody('C5:1', { start: 8 })[0]!.beat).toBe(8)
  })

  it('@ 指定力度時照用', () => {
    expect(melody('C5:1@0.42')[0]!.vel).toBe(0.42)
  })

  it('句尾（後面接長休止或結尾）比句中輕', () => {
    const [a, b, c] = melody('C5:1 D5:1 E5:2 r:4', { vel: 0.6 })
    expect(c!.vel!).toBeLessThan(a!.vel!)
    expect(c!.vel!).toBeLessThan(b!.vel!)
  })

  it('同一句裡力度不會全部一樣', () => {
    const vels = melody('C5:1 D5:1 E5:1 G5:1 A5:1 G5:1 E5:2').map((n) => n.vel)
    expect(new Set(vels).size).toBeGreaterThan(1)
  })

  it('小節線位置不對時拋錯，避免拍數寫錯', () => {
    expect(() => melody('C5:1 D5:2 | E5:4')).toThrow()
    expect(() => melody('C5:2 D5:2 | E5:4 |')).not.toThrow()
  })
})

describe('progression', () => {
  it('拆出和弦名並忽略小節線', () => {
    expect(progression('Fmaj7 Bbadd9 | Dm7 Csus2')).toEqual(['Fmaj7', 'Bbadd9', 'Dm7', 'Csus2'])
  })
})

describe('voiceChord', () => {
  it('把和弦音排進 lo 起算的一個八度內', () => {
    expect(voiceChord('Fmaj7', 53)).toEqual([53, 57, 60, 64])
    expect(voiceChord('Bbadd9', 53)).toEqual([53, 58, 60, 62])
  })

  it('支援 sus、小七、九和弦與 #11', () => {
    expect(voiceChord('Csus2', 48)).toEqual([48, 50, 55])
    expect(voiceChord('Csus4', 48)).toEqual([48, 53, 55])
    expect(voiceChord('Dm7', 48)).toEqual([48, 50, 53, 57])
    expect(voiceChord('Cm9', 48)).toEqual([48, 50, 51, 55, 58])
    expect(voiceChord('Abmaj7#11', 48)).toEqual([48, 50, 51, 55, 56])
  })

  it('看不懂的和弦直接拋錯', () => {
    expect(() => voiceChord('Fdim', 48)).toThrow()
  })
})

describe('chordTrack', () => {
  it('每個和弦各佔 beatsPerChord 拍，全部和弦音一起長音', () => {
    const notes = chordTrack(['F', 'C'], { lo: 53, beatsPerChord: 4, vel: 0.5 })
    expect(notes.filter((n) => n.beat === 0).map((n) => n.midi)).toEqual([53, 57, 60])
    expect(notes.filter((n) => n.beat === 4).map((n) => n.midi)).toEqual([55, 60, 64])
    expect(notes.every((n) => n.dur === 4)).toBe(true)
  })
})

describe('bassLine', () => {
  it('在指定拍點彈根音，斜線和弦改彈斜線後的低音', () => {
    const notes = bassLine(['F', 'F/Eb'], { lo: 40, hits: [0, 2], beatsPerChord: 4, dur: 1.5, vel: 0.6 })
    expect(notes.map((n) => [n.beat, n.midi])).toEqual([
      [0, 41],
      [2, 41],
      [4, 51],
      [6, 51],
    ])
  })

  it('第一拍之後的落點比較輕', () => {
    const [first, second] = bassLine(['F'], { lo: 40, hits: [0, 2], beatsPerChord: 4, dur: 1, vel: 0.6 })
    expect(second!.vel!).toBeLessThan(first!.vel!)
  })
})

describe('arpeggiate', () => {
  it('依 pattern 取和弦第幾個音，超出就往上一個八度', () => {
    const notes = arpeggiate(['C'], {
      lo: 60,
      beatsPerChord: 4,
      vel: 0.5,
      pattern: [
        [0, 0, 1],
        [1, 2, 1],
        [2, 3, 2],
      ],
    })
    expect(notes.map((n) => [n.beat, n.midi, n.dur])).toEqual([
      [0, 60, 1],
      [1, 67, 1],
      [2, 72, 2],
    ])
  })
})
