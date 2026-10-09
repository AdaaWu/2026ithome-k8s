import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day06Game from '@/presentation/games/days/Day06Game.vue'

// 每回合兩隻小鳥該不該放同一顆泡泡，依 specs/03 Day 6 回合順序
const TOGETHER = [true, false, false, true]

async function placeAndBlow(wrapper: VueWrapper, together: boolean) {
  await wrapper.get('[data-bird="0"]').trigger('click')
  await wrapper.get('[data-bubble=A]').trigger('click')
  await wrapper.get('[data-bird="1"]').trigger('click')
  await wrapper.get(`[data-bubble=${together ? 'A' : 'B'}]`).trigger('click')
  await wrapper.get('[data-test=blow]').trigger('click')
}

describe('Day06Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('兩個 :80 放同一顆會撞號，不會過回合', async () => {
    const wrapper = mount(Day06Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await placeAndBlow(wrapper, true)
    await vi.advanceTimersByTimeAsync(2000)
    await placeAndBlow(wrapper, false)
    await vi.advanceTimersByTimeAsync(2000)

    await placeAndBlow(wrapper, true)
    expect(wrapper.get('[role=status]').text()).toContain('80')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(2)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
  })

  it('四回合都配對正確，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day06Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    for (const together of TOGETHER) {
      await placeAndBlow(wrapper, together)
      await vi.advanceTimersByTimeAsync(2000)
    }
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('放置區是按鈕；同回合連錯 2 次後一步一步閃出正解', async () => {
    const wrapper = mount(Day06Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    expect(wrapper.get('[data-bubble=A]').element.tagName).toBe('BUTTON')

    // 第 1 回合該放同一顆，連續分開放 2 次
    for (let i = 0; i < 2; i++) {
      await placeAndBlow(wrapper, false)
      await vi.advanceTimersByTimeAsync(1500)
    }
    expect(wrapper.get('[data-bird="0"]').classes()).toContain('is-flash')
    await wrapper.get('[data-bird="0"]').trigger('click')
    await wrapper.get('[data-bubble=A]').trigger('click')
    await wrapper.get('[data-bird="1"]').trigger('click')
    expect(wrapper.find('.room.is-flash').exists()).toBe(true)
    await wrapper.get('.room.is-flash [data-bubble]').trigger('click')
    expect(wrapper.get('[data-test=blow]').classes()).toContain('is-flash')
    await wrapper.get('[data-test=blow]').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(1)
  })
})
