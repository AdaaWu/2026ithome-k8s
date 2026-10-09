import { beforeEach, describe, expect, it } from 'vitest'
import { SAVE_KEY, loadProgress, saveProgress } from '@/infrastructure/progressStorage'
import { createEmptyProgress, markDayCleared, setNickname } from '@/domain/progress'

describe('progressStorage', () => {
  beforeEach(() => localStorage.clear())

  it('沒有存檔時回傳全新存檔', () => {
    expect(loadProgress()).toEqual(createEmptyProgress())
  })

  it('存了再讀回來內容一樣', () => {
    const p = markDayCleared(setNickname(createEmptyProgress(), '小桑'), 3)
    saveProgress(p)
    expect(loadProgress()).toEqual(p)
  })

  it('JSON 壞掉時回傳全新存檔', () => {
    localStorage.setItem(SAVE_KEY, '{not json')
    expect(loadProgress()).toEqual(createEmptyProgress())
  })

  it('欄位型別不對時回傳全新存檔', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, nickname: 1, clearedDays: 'x' }))
    expect(loadProgress()).toEqual(createEmptyProgress())
  })
})

describe('progressStorage 防止壞存檔', () => {
  beforeEach(() => localStorage.clear())

  it('clearedDays 重複或超出 1–30 時會被清掉', () => {
    const tampered = { ...createEmptyProgress(), clearedDays: [3, 3, 3, 0, 31, 2.5, 7] }
    localStorage.setItem(SAVE_KEY, JSON.stringify(tampered))
    expect(loadProgress().clearedDays).toEqual([3, 7])
  })

  it('角色清單重複時會去重', () => {
    const tampered = { ...createEmptyProgress(), seenCharacters: ['bird', 'bird'], unlockedCharacters: ['bird', 'bird'] }
    localStorage.setItem(SAVE_KEY, JSON.stringify(tampered))
    expect(loadProgress().unlockedCharacters).toEqual(['bird'])
    expect(loadProgress().seenCharacters).toEqual(['bird'])
  })
})
