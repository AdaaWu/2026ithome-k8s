import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useTicker } from '@/presentation/games/kit/useTicker'

describe('useTicker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('每個節拍呼叫 onTick，帶入從 1 開始的次數', () => {
    const onTick = vi.fn()
    const scope = effectScope()
    const t = scope.run(() => useTicker(500, onTick))!
    t.start()
    expect(t.running.value).toBe(true)
    vi.advanceTimersByTime(1500)
    expect(onTick.mock.calls.map((c) => c[0])).toEqual([1, 2, 3])
    scope.stop()
  })

  it('stop 後不再觸發，再次 start 從 1 重新計數', () => {
    const onTick = vi.fn()
    const scope = effectScope()
    const t = scope.run(() => useTicker(100, onTick))!
    t.start()
    vi.advanceTimersByTime(200)
    t.stop()
    expect(t.running.value).toBe(false)
    vi.advanceTimersByTime(500)
    expect(onTick).toHaveBeenCalledTimes(2)
    t.start()
    vi.advanceTimersByTime(100)
    expect(onTick).toHaveBeenLastCalledWith(1)
    scope.stop()
  })

  it('重複 start 不會疊加計時器', () => {
    const onTick = vi.fn()
    const scope = effectScope()
    const t = scope.run(() => useTicker(100, onTick))!
    t.start()
    t.start()
    vi.advanceTimersByTime(100)
    expect(onTick).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('scope 結束時自動清除', () => {
    const onTick = vi.fn()
    const scope = effectScope()
    scope.run(() => useTicker(100, onTick))!.start()
    scope.stop()
    vi.advanceTimersByTime(500)
    expect(onTick).not.toHaveBeenCalled()
  })
})
