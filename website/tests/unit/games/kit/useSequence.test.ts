import { describe, expect, it } from 'vitest'
import { useSequence } from '@/presentation/games/kit/useSequence'

describe('useSequence', () => {
  it('依序點對回 ok，最後一個回 done', () => {
    const s = useSequence(['a', 'b', 'c'])
    expect(s.tap('a')).toBe('ok')
    expect(s.tap('b')).toBe('ok')
    expect(s.tap('c')).toBe('done')
    expect(s.done.value).toBe(true)
  })

  it('點錯回 wrong 且不前進', () => {
    const s = useSequence(['a', 'b'])
    expect(s.tap('b')).toBe('wrong')
    expect(s.index.value).toBe(0)
  })

  it('完成後再點一律回 done', () => {
    const s = useSequence(['a'])
    s.tap('a')
    expect(s.tap('a')).toBe('done')
  })

  it('reset 可換成下一回合的序列', () => {
    const s = useSequence<string>(['a'])
    s.tap('a')
    s.reset(['x', 'y'])
    expect(s.index.value).toBe(0)
    expect(s.done.value).toBe(false)
    expect(s.tap('a')).toBe('wrong')
    expect(s.tap('x')).toBe('ok')
  })

  it('reset 不帶參數時重來同一序列', () => {
    const s = useSequence(['a', 'b'])
    s.tap('a')
    s.reset()
    expect(s.tap('a')).toBe('ok')
  })
})
