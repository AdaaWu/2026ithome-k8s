import { describe, expect, it } from 'vitest'
import { RULER_TITLE, getTitle, isIslandRuler } from '@/domain/achievement'
import { createEmptyProgress, type GameProgress } from '@/domain/progress'
import { TOTAL_DAYS } from '@/domain/level'

const ALL = ['bird', 'bubble', 'tree']
const allDays = Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1)

function progressWith(partial: Partial<GameProgress>): GameProgress {
  return { ...createEmptyProgress(), ...partial }
}

describe('isIslandRuler', () => {
  it('30 關全破且全部角色看過並答對，就是統治大王', () => {
    const p = progressWith({ clearedDays: allDays, seenCharacters: ALL, unlockedCharacters: ALL })
    expect(isIslandRuler(p, ALL)).toBe(true)
  })

  it('少一隻角色就不是', () => {
    const p = progressWith({ clearedDays: allDays, seenCharacters: ALL, unlockedCharacters: ['bird', 'bubble'] })
    expect(isIslandRuler(p, ALL)).toBe(false)
  })

  it('少一關就不是', () => {
    const p = progressWith({ clearedDays: allDays.slice(1), seenCharacters: ALL, unlockedCharacters: ALL })
    expect(isIslandRuler(p, ALL)).toBe(false)
  })
})

describe('getTitle', () => {
  it.each([
    [[], [], '迷路的旅人'],
    [[1], [], '登島新手'],
    [[], ['bird'], '登島新手'],
    [allDays.slice(0, 10), [], '泡泡吹手'],
    [allDays.slice(0, 20), [], '燈塔村見習生'],
    [allDays, ['bird'], '雲之島守護者'],
    [allDays, ALL, RULER_TITLE],
  ])('過關 %j、圖鑑 %j → %s', (days, unlocked, title) => {
    const p = progressWith({ clearedDays: days, seenCharacters: unlocked, unlockedCharacters: unlocked })
    expect(getTitle(p, ALL)).toBe(title)
  })

  it('統治大王稱號字樣固定', () => {
    expect(RULER_TITLE).toBe('K8s 雲之島統治大王')
  })
})

describe('isIslandRuler 防止重複 Day 灌水', () => {
  it('30 個重複的 Day 不算全破', () => {
    const p = progressWith({ clearedDays: Array(30).fill(1), seenCharacters: ALL, unlockedCharacters: ALL })
    expect(isIslandRuler(p, ALL)).toBe(false)
  })
})
