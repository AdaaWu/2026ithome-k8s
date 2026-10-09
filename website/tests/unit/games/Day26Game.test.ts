import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day26Game from '@/presentation/games/days/Day26Game.vue'

const ANSWERS = ['6', '3', 'keep', 'unknown', 'keep']

describe('Day26Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('答錯 2 回合就失敗，再玩一次回到第 1 回合', async () => {
    const wrapper = mount(Day26Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-answer="5"]').trigger('click')
    expect(wrapper.get('[role=status]').text()).not.toBe('')
    await wrapper.get('[data-answer="6"]').trigger('click')
    await vi.advanceTimersByTimeAsync(2500)
    await wrapper.get('[data-answer="4"]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.get('[data-test=round]').text()).toContain('1')
  })

  it('5 回合全對後，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day26Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (const answer of ANSWERS) {
      await wrapper.get(`[data-answer="${answer}"]`).trigger('click')
      await vi.advanceTimersByTimeAsync(2500)
    }

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('同一回合錯 1 次不閃，錯 2 次才閃正解', async () => {
    const wrapper = mount(Day26Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await wrapper.get('[data-answer="5"]').trigger('click')
    expect(wrapper.find('.is-flash').exists()).toBe(false)
    await wrapper.get('[data-answer="7"]').trigger('click')
    expect(wrapper.get('[data-answer="6"]').classes()).toContain('is-flash')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
  })
})
