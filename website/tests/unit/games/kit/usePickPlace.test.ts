import { describe, expect, it } from 'vitest'
import { usePickPlace } from '@/presentation/games/kit/usePickPlace'

describe('usePickPlace', () => {
  it('沒選東西就放，回傳先選一個', () => {
    const p = usePickPlace<'pod', 'node'>()
    expect(p.place('node')).toEqual({ ok: false, reason: '先選一個' })
  })

  it('再點同一個 item 取消選取', () => {
    const p = usePickPlace<'a' | 'b', 's'>()
    p.pick('a')
    expect(p.picked.value).toBe('a')
    p.pick('b')
    expect(p.picked.value).toBe('b')
    p.pick('b')
    expect(p.picked.value).toBeNull()
  })

  it('放成功回傳 item 與 slot 並清空選取', () => {
    const p = usePickPlace<'a', 's1'>()
    p.pick('a')
    expect(p.place('s1')).toEqual({ ok: true, item: 'a', slot: 's1' })
    expect(p.picked.value).toBeNull()
  })

  it('canPlace 回字串時拒絕並保留選取', () => {
    const p = usePickPlace<'big', 'small'>({ canPlace: () => '空間不夠' })
    p.pick('big')
    expect(p.place('small')).toEqual({ ok: false, reason: '空間不夠' })
    expect(p.picked.value).toBe('big')
  })

  it('cancel 清空選取', () => {
    const p = usePickPlace<'a', 's'>()
    p.pick('a')
    p.cancel()
    expect(p.picked.value).toBeNull()
  })
})
