import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useHint } from '@/presentation/games/kit/useHint'

describe('useHint', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('show 顯示文字，預設 2200ms 後消失', () => {
    const scope = effectScope()
    const h = scope.run(() => useHint())!
    h.show('答對了', 'good')
    expect(h.text.value).toBe('答對了')
    expect(h.tone.value).toBe('good')
    vi.advanceTimersByTime(2199)
    expect(h.text.value).toBe('答對了')
    vi.advanceTimersByTime(1)
    expect(h.text.value).toBeNull()
    scope.stop()
  })

  it('tone 預設 info，可指定顯示時間', () => {
    const scope = effectScope()
    const h = scope.run(() => useHint(1000))!
    h.show('提示')
    expect(h.tone.value).toBe('info')
    vi.advanceTimersByTime(1000)
    expect(h.text.value).toBeNull()
    h.show('久一點', 'bad', 5000)
    vi.advanceTimersByTime(4000)
    expect(h.text.value).toBe('久一點')
    scope.stop()
  })

  it('新的 show 取代舊的，計時重新開始', () => {
    const scope = effectScope()
    const h = scope.run(() => useHint(1000))!
    h.show('一')
    vi.advanceTimersByTime(800)
    h.show('二')
    vi.advanceTimersByTime(800)
    expect(h.text.value).toBe('二')
    scope.stop()
  })

  it('clear 立即清除', () => {
    const scope = effectScope()
    const h = scope.run(() => useHint())!
    h.show('提示')
    h.clear()
    expect(h.text.value).toBeNull()
    scope.stop()
  })
})
