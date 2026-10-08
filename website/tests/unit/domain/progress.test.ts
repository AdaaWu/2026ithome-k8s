import { describe, expect, it } from 'vitest'
import {
  createEmptyProgress,
  markCharacterSeen,
  markDayCleared,
  normalizeNickname,
  setNickname,
  unlockCharacter,
} from '@/domain/progress'

describe('normalizeNickname', () => {
  it('去掉頭尾空白', () => {
    expect(normalizeNickname('  小桑  ')).toBe('小桑')
  })

  it('超過 12 字會被截斷', () => {
    expect(normalizeNickname('一二三四五六七八九十壹貳參')).toBe('一二三四五六七八九十壹貳')
  })

  it('emoji 以一個字計算，不會被切壞', () => {
    expect(normalizeNickname('🐦'.repeat(13))).toBe('🐦'.repeat(12))
  })
})

describe('progress 狀態轉換', () => {
  it('新存檔什麼都沒有', () => {
    const p = createEmptyProgress()
    expect(p.nickname).toBe('')
    expect(p.clearedDays).toEqual([])
    expect(p.seenCharacters).toEqual([])
    expect(p.unlockedCharacters).toEqual([])
  })

  it('設定暱稱', () => {
    expect(setNickname(createEmptyProgress(), ' 小桑 ').nickname).toBe('小桑')
  })

  it('過關的 Day 不重複且遞增排序', () => {
    let p = createEmptyProgress()
    p = markDayCleared(p, 5)
    p = markDayCleared(p, 2)
    p = markDayCleared(p, 5)
    expect(p.clearedDays).toEqual([2, 5])
  })

  it('超出 1–30 的 Day 不會被記錄', () => {
    let p = createEmptyProgress()
    p = markDayCleared(p, 0)
    p = markDayCleared(p, 31)
    expect(p.clearedDays).toEqual([])
  })

  it('看過與解鎖的角色不重複', () => {
    let p = createEmptyProgress()
    p = markCharacterSeen(p, 'bird')
    p = markCharacterSeen(p, 'bird')
    p = unlockCharacter(p, 'bird')
    p = unlockCharacter(p, 'bird')
    expect(p.seenCharacters).toEqual(['bird'])
    expect(p.unlockedCharacters).toEqual(['bird'])
  })

  it('解鎖角色時一併記為看過', () => {
    const p = unlockCharacter(createEmptyProgress(), 'owl')
    expect(p.seenCharacters).toContain('owl')
  })

  it('狀態轉換不改動原物件', () => {
    const p = createEmptyProgress()
    markDayCleared(p, 1)
    expect(p.clearedDays).toEqual([])
  })
})
