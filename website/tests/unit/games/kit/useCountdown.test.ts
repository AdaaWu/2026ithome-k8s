import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useCountdown } from '@/presentation/games/kit/useCountdown'

describe('useCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('start 後隨時間遞減，pause 後停住', () => {
    const scope = effectScope()
    const c = scope.run(() => useCountdown(6))!
    c.start()
    expect(c.running.value).toBe(true)
    vi.advanceTimersByTime(1500)
    expect(c.remaining.value).toBeCloseTo(4.5)
    c.pause()
    vi.advanceTimersByTime(2000)
    expect(c.remaining.value).toBeCloseTo(4.5)
    expect(c.running.value).toBe(false)
    scope.stop()
  })

  it('歸零時呼叫 onExpire 一次並停止', () => {
    const onExpire = vi.fn()
    const scope = effectScope()
    const c = scope.run(() => useCountdown(2, { onExpire }))!
    c.start()
    vi.advanceTimersByTime(5000)
    expect(c.remaining.value).toBe(0)
    expect(c.running.value).toBe(false)
    expect(onExpire).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('reset 停止計時並回到原秒數，或指定新秒數', () => {
    const scope = effectScope()
    const c = scope.run(() => useCountdown(6))!
    c.start()
    vi.advanceTimersByTime(3000)
    c.reset()
    expect(c.remaining.value).toBe(6)
    expect(c.running.value).toBe(false)
    c.reset(10)
    expect(c.remaining.value).toBe(10)
    scope.stop()
  })

  it('scope 結束時自動清除計時器', () => {
    const onExpire = vi.fn()
    const scope = effectScope()
    const c = scope.run(() => useCountdown(1, { onExpire }))!
    c.start()
    scope.stop()
    vi.advanceTimersByTime(3000)
    expect(onExpire).not.toHaveBeenCalled()
  })
})
