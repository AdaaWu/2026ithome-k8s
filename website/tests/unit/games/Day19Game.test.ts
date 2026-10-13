import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day19Game from '@/presentation/games/days/Day19Game.vue'

async function act(wrapper: VueWrapper, action: 'sync' | 'restartA' | 'restartB') {
  await wrapper.get(`[data-action=${action}]`).trigger('click')
}

describe('Day19Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('環境變數只等同步不會更新；答錯的重啟也計入次數', async () => {
    const wrapper = mount(Day19Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await act(wrapper, 'sync')
    await vi.advanceTimersByTimeAsync(2000)

    // 回合 2 改 LOG_LEVEL：只等同步不會過
    await act(wrapper, 'sync')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(1)

    for (let i = 0; i < 4; i++) await act(wrapper, 'restartB')
    expect(wrapper.get('.count').text()).toBe('重啟 4 次')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.get('[data-action=restartA]').classes()).toContain('is-flash')
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

  it('連錯多次後按閃爍的正解仍能過關，不會因重啟次數失敗', async () => {
    const wrapper = mount(Day19Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    // 回合 1 改 index.html：多花一次重啟 B 也算過
    await act(wrapper, 'restartB')
    await vi.advanceTimersByTimeAsync(2000)
    // 回合 2 改 LOG_LEVEL：先亂重啟 B 三次，再按閃爍的重啟 A
    for (let i = 0; i < 3; i++) await act(wrapper, 'restartB')
    await act(wrapper, 'restartA')
    await vi.advanceTimersByTimeAsync(2000)
    // 回合 3 改 nginx.conf：亂重啟 A 三次後，閃爍的重啟 B 仍可按
    for (let i = 0; i < 3; i++) await act(wrapper, 'restartA')
    expect(wrapper.get('[data-action=restartB]').classes()).toContain('is-flash')
    await act(wrapper, 'restartB')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.get('.count').text()).toBe('重啟 9 次')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(true)
  })
})
