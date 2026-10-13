import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { GAME_PAUSED } from '@/presentation/games/kit'
import { useCountdown } from '@/presentation/games/kit/useCountdown'
import { useTicker } from '@/presentation/games/kit/useTicker'
import { useTimeouts } from '@/presentation/games/kit/useTimeouts'

/** 在提供暫停訊號的元件裡執行 hook */
function runPausable<T>(setup: () => T) {
  const paused = ref(false)
  let api!: T
  const Host = defineComponent({
    setup() {
      api = setup()
      return () => null
    },
  })
  const wrapper = mount(Host, { global: { provide: { [GAME_PAUSED as symbol]: paused } } })
  return { api, paused, wrapper }
}

describe('遊戲暫停訊號', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('倒數在暫停期間不遞減，恢復後接著倒數', () => {
    const { api, paused } = runPausable(() => useCountdown(10))
    api.start()
    vi.advanceTimersByTime(1000)
    paused.value = true
    vi.advanceTimersByTime(5000)
    expect(api.remaining.value).toBeCloseTo(9)
    expect(api.running.value).toBe(true)
    paused.value = false
    vi.advanceTimersByTime(1000)
    expect(api.remaining.value).toBeCloseTo(8)
  })

  it('節拍在暫停期間不觸發，恢復後補完這一拍剩下的時間', () => {
    const onTick = vi.fn()
    const { api, paused } = runPausable(() => useTicker(1000, onTick))
    api.start()
    vi.advanceTimersByTime(600)
    paused.value = true
    vi.advanceTimersByTime(5000)
    expect(onTick).not.toHaveBeenCalled()
    paused.value = false
    vi.advanceTimersByTime(399)
    expect(onTick).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onTick).toHaveBeenLastCalledWith(1)
    vi.advanceTimersByTime(1000)
    expect(onTick).toHaveBeenLastCalledWith(2)
  })

  it('暫停中 start 的節拍等恢復後才開始', () => {
    const onTick = vi.fn()
    const { api, paused } = runPausable(() => useTicker(500, onTick))
    paused.value = true
    api.start()
    vi.advanceTimersByTime(2000)
    expect(onTick).not.toHaveBeenCalled()
    paused.value = false
    vi.advanceTimersByTime(500)
    expect(onTick).toHaveBeenCalledOnce()
  })

  it('延遲回呼在暫停期間凍結剩餘時間', () => {
    const fn = vi.fn()
    const { api, paused } = runPausable(() => useTimeouts())
    api.later(fn, 1000)
    vi.advanceTimersByTime(700)
    paused.value = true
    vi.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()
    paused.value = false
    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('暫停中 clearAll 後恢復不會執行舊回呼', () => {
    const fn = vi.fn()
    const { api, paused } = runPausable(() => useTimeouts())
    api.later(fn, 500)
    paused.value = true
    api.clearAll()
    paused.value = false
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })
})
