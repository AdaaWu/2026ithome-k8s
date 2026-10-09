import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day19Game from '@/presentation/games/days/Day19Game.vue'

async function act(wrapper: VueWrapper, action: 'sync' | 'restartA' | 'restartB') {
  await wrapper.get(`[data-action=${action}]`).trigger('click')
}

describe('Day19Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('環境變數只等同步不會更新；亂重啟超過 3 次會失敗，再玩一次可重來', async () => {
    const wrapper = mount(Day19Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await act(wrapper, 'sync')
    await vi.advanceTimersByTimeAsync(2000)

    // 回合 2 改 LOG_LEVEL：只等同步不會過
    await act(wrapper, 'sync')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(1)

    for (let i = 0; i < 4; i++) await act(wrapper, 'restartB')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(0)
    expect(wrapper.get('[data-action=sync]').attributes('disabled')).toBeUndefined()
  })

  it('用最少重啟完成三回合，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day19Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await act(wrapper, 'sync')
    await vi.advanceTimersByTimeAsync(2000)
    await act(wrapper, 'restartA')
    await vi.advanceTimersByTimeAsync(2000)
    await act(wrapper, 'sync')
    await act(wrapper, 'restartB')
    await vi.advanceTimersByTimeAsync(2000)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('失敗後 retry，舊的延遲回呼不會改到新局', async () => {
    const wrapper = mount(Day19Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    // 回合 1 改 index.html：連按 4 次重啟 A 都沒用，第 4 次超過上限
    for (let i = 0; i < 4; i++) await act(wrapper, 'restartA')
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.find('.kchar--shake').exists()).toBe(false)
    expect(wrapper.find('.is-flash').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.find('.kchar--shake').exists()).toBe(false)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.get('.count').text()).toBe('重啟 0 / 3 次')
  })
})
