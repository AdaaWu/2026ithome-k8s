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
