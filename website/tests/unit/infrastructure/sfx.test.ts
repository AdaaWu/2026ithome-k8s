import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeAudioContext } from './audio/fakeAudioContext'

const MUTE_KEY = 'k8s-cloud-island-muted'
const load = async () => {
  vi.resetModules()
  return import('@/infrastructure/sfx')
}

describe('sfx 音效開關', () => {
  beforeEach(() => localStorage.clear())

  it('預設音效開啟', async () => {
    expect((await load()).isMuted()).toBe(false)
  })

  it('沿用原本的 key 讀寫', async () => {
    localStorage.setItem(MUTE_KEY, '1')
    const sfx = await load()
    expect(sfx.isMuted()).toBe(true)
    sfx.setMuted(false)
    expect(localStorage.getItem(MUTE_KEY)).toBe('0')
  })

  it('不支援 WebAudio 時播放不出錯', async () => {
    const sfx = await load()
    expect(() => sfx.playSfx('win')).not.toThrow()
  })

  describe('有 WebAudio 時', () => {
    let made: FakeAudioContext[]
    let hidden: boolean

    beforeEach(() => {
      made = []
      hidden = false
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
      vi.stubGlobal(
        'AudioContext',
        class extends FakeAudioContext {
          constructor() {
            super()
            made.push(this)
          }
        },
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    async function loadWithMusic() {
      const sfx = await load()
      const bgm = await import('@/infrastructure/audio/bgm')
      bgm.playScene('map')
      bgm.unlock()
      return { sfx, ctx: made[0] }
    }

    const ducked = (ctx: FakeAudioContext) => ctx.gains.some((g) => g.gain.events.some(([k, v]) => k === 'linear' && v === 0.5))

    it('音效送進音樂同一顆殘響，全站只有一顆 Convolver', async () => {
      const { sfx, ctx } = await loadWithMusic()
      sfx.playSfx('correct')
      sfx.playSfx('win')
      expect(ctx.convolvers).toHaveLength(1)
    })

    it('tap 不壓低音樂，其他音效會', async () => {
      const { sfx, ctx } = await loadWithMusic()
      sfx.playSfx('tap')
      expect(ducked(ctx)).toBe(false)
      sfx.playSfx('pop')
      expect(ducked(ctx)).toBe(true)
    })

    it('分頁隱藏時不播音效', async () => {
      const { sfx, ctx } = await loadWithMusic()
      const before = ctx.oscillators.length
      hidden = true
      sfx.playSfx('win')
      expect(ctx.oscillators.length).toBe(before)
    })

    it('音效播完後釋放自己的節點，共用的音效通道保留', async () => {
      const { sfx, ctx } = await loadWithMusic()
      sfx.playSfx('tap')
      const before = ctx.nodes.length
      sfx.playSfx('pop')
      const made = ctx.nodes.slice(before)
      ctx.oscillators.filter((o) => made.includes(o)).forEach((o) => o.onended?.())
      expect(made.length).toBeGreaterThan(0)
      expect(made.every((n) => n.disconnected)).toBe(true)
    })

    it('瀏覽器拒絕恢復時不留下未處理的錯誤', async () => {
      const { sfx, ctx } = await loadWithMusic()
      ctx.state = 'suspended'
      const denied = Promise.reject(new Error('denied'))
      const caught = vi.spyOn(denied, 'catch')
      ctx.resume = vi.fn(() => denied)
      sfx.playSfx('pop')
      expect(caught).toHaveBeenCalled()
      denied.catch(() => {})
    })

    it('context 中斷時播音效會嘗試恢復', async () => {
      const { sfx, ctx } = await loadWithMusic()
      ctx.state = 'interrupted'
      sfx.playSfx('pop')
      expect(ctx.resume).toHaveBeenCalled()
    })
  })
})
