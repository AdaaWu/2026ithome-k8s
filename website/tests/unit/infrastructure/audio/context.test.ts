import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeAudioContext } from './fakeAudioContext'

const load = async () => {
  vi.resetModules()
  return import('@/infrastructure/audio/context')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('共用 AudioContext', () => {
  it('不支援 WebAudio 時回傳 null', async () => {
    const { getAudioContext } = await load()
    expect(getAudioContext()).toBeNull()
  })

  it('只建立一次', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const { getAudioContext } = await load()
    expect(getAudioContext()).toBe(getAudioContext())
  })

  it('中斷狀態在下一次手勢時恢復', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const { getAudioContext } = await load()
    const ctx = getAudioContext() as unknown as FakeAudioContext
    ctx.state = 'interrupted'
    window.dispatchEvent(new Event('click'))
    expect(ctx.resume).toHaveBeenCalled()
  })

  it.each(['running', 'closed'])('%s 狀態不需要恢復', async (state) => {
    const { needsResume } = await load()
    expect(needsResume({ state } as unknown as BaseAudioContext)).toBe(false)
  })
})
