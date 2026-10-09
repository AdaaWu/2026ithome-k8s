import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day17Game from '@/presentation/games/days/Day17Game.vue'

// Math.random 固定 0.999 時洗牌維持原順序：A 503 名單、B 503 看板、C 404、D timeout
const BREAKS = ['endpoints', 'ingress', 'ingress', 'controller']
const OK_STATIONS = ['controller', 'ingress', 'service', 'pod']

async function start() {
  const wrapper = mount(Day17Game)
  await wrapper.get('[data-test=shell-start]').trigger('click')
  return wrapper
}

describe('Day17Game', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('檢查超過 10 次就失敗，再玩一次歸零', async () => {
    const wrapper = await start()
    for (let round = 0; round < 2; round++) {
      const healthy = round === 0 ? OK_STATIONS : ['controller', 'service', 'endpoints', 'pod']
      for (const id of healthy) await wrapper.get(`[data-station=${id}]`).trigger('click')
      await wrapper.get(`[data-station=${BREAKS[round]}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1500)
    }
    await wrapper.get('[data-station=controller]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.get('[data-test=checks]').text()).toBe('檢查 0 / 10')
  })

  it('retry 會重新洗牌回合順序，舊的延遲回呼不會改到新局', async () => {
    const wrapper = await start()
    for (let round = 0; round < 2; round++) {
      const healthy = round === 0 ? OK_STATIONS : ['controller', 'service', 'endpoints', 'pod']
      for (const id of healthy) await wrapper.get(`[data-station=${id}]`).trigger('click')
      await wrapper.get(`[data-station=${BREAKS[round]}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1500)
    }
    // 第 11 次檢查剛好點到正常站，留下 400ms 的搖晃回呼
    await wrapper.get('[data-station=service]').trigger('click')
    // 換一組亂數，新順序第一題是 C 404
    vi.spyOn(Math, 'random').mockReturnValue(0.4)
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.get('[data-test=code]').text()).toBe('404')
    expect(wrapper.find('.kchar--shake').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.get('[data-test=checks]').text()).toBe('檢查 0 / 10')
  })

  it('每回合直接點到斷點，4 回合後過關，complete 只發一次', async () => {
    const wrapper = await start()
    for (const id of BREAKS) {
      await wrapper.get(`[data-station=${id}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1500)
    }
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})
