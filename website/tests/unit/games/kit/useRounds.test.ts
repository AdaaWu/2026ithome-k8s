import { describe, expect, it } from 'vitest'
import { useRounds } from '@/presentation/games/kit/useRounds'

describe('useRounds', () => {
  it('從第一回合開始，結果全為 null', () => {
    const r = useRounds(['a', 'b', 'c'])
    expect(r.index.value).toBe(0)
    expect(r.current.value).toBe('a')
    expect(r.results.value).toEqual([null, null, null])
    expect(r.isLast.value).toBe(false)
  })

  it('record 記錄當回合結果，next 前進', () => {
    const r = useRounds(['a', 'b'])
    r.record(true)
    expect(r.next()).toBe(true)
    r.record(false)
    expect(r.current.value).toBe('b')
    expect(r.isLast.value).toBe(true)
    expect(r.results.value).toEqual(['ok', 'miss'])
  })

  it('最後一回合 next 回傳 false 且不前進', () => {
    const r = useRounds(['a'])
    expect(r.next()).toBe(false)
    expect(r.index.value).toBe(0)
  })

  it('reset 回到第一回合並清空結果', () => {
    const r = useRounds(['a', 'b'])
    r.record(true)
    r.next()
    r.reset()
    expect(r.index.value).toBe(0)
    expect(r.results.value).toEqual([null, null])
  })
})
