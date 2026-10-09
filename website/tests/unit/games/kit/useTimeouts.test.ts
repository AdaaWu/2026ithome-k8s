import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useTimeouts } from '@/presentation/games/kit/useTimeouts'

describe('useTimeouts', () => {
  it('later 到時間會執行', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    effectScope().run(() => useTimeouts())!.later(fn, 500)
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('clearAll 會取消所有還沒執行的回呼，供 retry 使用', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const t = effectScope().run(() => useTimeouts())!
    t.later(fn, 500)
    t.later(fn, 900)
    t.clearAll()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('scope 結束（元件卸載）時自動清除', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const scope = effectScope()
    scope.run(() => useTimeouts())!.later(fn, 500)
    scope.stop()
    vi.advanceTimersByTime(600)
    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
