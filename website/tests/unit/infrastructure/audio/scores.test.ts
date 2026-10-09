import { describe, expect, it } from 'vitest'
import type { Instrument, SceneId, Score } from '@/infrastructure/audio/score'
import { SCORES } from '@/infrastructure/audio/scores'

const SCENES: SceneId[] = ['title', 'map', 'day', 'codex', 'ruler']

const RANGE: Record<Instrument, [number, number]> = {
  musicBox: [72, 96],
  chime: [72, 96],
  felt: [55, 84],
  pad: [48, 72],
  bass: [36, 52],
}

/** 長音可以跨過循環點，但不能超過這個拍數 */
const LOOP_OVERHANG = 4

const density = (score: Score) =>
  score.tracks.reduce((sum, t) => sum + t.notes.length, 0) / score.lengthBeats

describe('SCORES', () => {
  it('五個場景都有曲子，且 id 對得上', () => {
    expect(Object.keys(SCORES).sort()).toEqual([...SCENES].sort())
    for (const id of SCENES) expect(SCORES[id].id).toBe(id)
  })

  describe.each(SCENES)('%s', (id) => {
    const score = SCORES[id]

    it('速度 60–88 bpm，swing 0–0.3', () => {
      expect(score.bpm).toBeGreaterThanOrEqual(60)
      expect(score.bpm).toBeLessThanOrEqual(88)
      expect(score.swing ?? 0).toBeGreaterThanOrEqual(0)
      expect(score.swing ?? 0).toBeLessThanOrEqual(0.3)
    })

    it('長度是整數小節（4/4）', () => {
      expect(score.lengthBeats).toBeGreaterThan(0)
      expect(score.lengthBeats % 4).toBe(0)
    })

    it('每個音都落在循環內，長音跨過循環點不超過容許值', () => {
      for (const t of score.tracks) {
        for (const n of t.notes) {
          expect(n.beat).toBeGreaterThanOrEqual(0)
          expect(n.beat).toBeLessThan(score.lengthBeats)
          expect(n.dur).toBeGreaterThan(0)
          expect(n.beat + n.dur).toBeLessThanOrEqual(score.lengthBeats + LOOP_OVERHANG)
        }
      }
    })

    it('音高是整數且在各樂器音域內', () => {
      for (const t of score.tracks) {
        const [lo, hi] = RANGE[t.instrument]
        for (const n of t.notes) {
          expect(Number.isInteger(n.midi)).toBe(true)
          expect(n.midi, `${t.instrument} ${n.midi}`).toBeGreaterThanOrEqual(lo)
          expect(n.midi, `${t.instrument} ${n.midi}`).toBeLessThanOrEqual(hi)
        }
      }
    })

    it('力度與音軌音量在 0–1', () => {
      for (const t of score.tracks) {
        expect(t.gain ?? 1).toBeGreaterThan(0)
        expect(t.gain ?? 1).toBeLessThanOrEqual(1)
        for (const n of t.notes) {
          expect(n.vel ?? 0.7).toBeGreaterThan(0)
          expect(n.vel ?? 0.7).toBeLessThanOrEqual(1)
        }
      }
    })

    it('同一軌的力度不會全部一樣', () => {
      for (const t of score.tracks) {
        if (t.notes.length < 2) continue
        expect(new Set(t.notes.map((n) => n.vel)).size, t.instrument).toBeGreaterThan(1)
      }
    })

    it('旋律樂器平均每拍不超過 2 個音', () => {
      for (const t of score.tracks) {
        if (t.instrument !== 'musicBox' && t.instrument !== 'felt') continue
        expect(t.notes.length / score.lengthBeats, t.instrument).toBeLessThanOrEqual(2)
      }
    })

    it('低音只出現在每小節第一拍或第三拍', () => {
      for (const t of score.tracks) {
        if (t.instrument !== 'bass') continue
        for (const n of t.notes) expect([0, 2]).toContain(n.beat % 4)
      }
    })
  })

  it('day 是五首裡最稀疏的', () => {
    const day = density(SCORES.day)
    for (const id of SCENES) {
      if (id !== 'day') expect(day).toBeLessThan(density(SCORES[id]))
    }
  })
})
