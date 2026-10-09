import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day09Game from '@/presentation/games/days/Day09Game.vue'

describe('Day09Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('一直戳泡泡會被補回來，不會過關', async () => {
    const wrapper = mount(Day09Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (let i = 0; i < 6; i++) {
      await wrapper.get('[data-app=hello]').trigger('click')
      await vi.advanceTimersByTimeAsync(1000)
    }
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.findAll('[data-app=hello]')).toHaveLength(3)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
  })

  it('把期望數量調到 0 並維持 3 秒，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day09Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (let i = 0; i < 3; i++) await wrapper.get('[data-test=minus]').trigger('click')
    await vi.advanceTimersByTimeAsync(3600)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('連戳 2 顆泡泡，減號開始閃', async () => {
    const wrapper = mount(Day09Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-app=hello]').trigger('click')
    expect(wrapper.get('[data-test=minus]').classes()).not.toContain('is-flash')
    await vi.advanceTimersByTimeAsync(1000)
    await wrapper.get('[data-app=hello]').trigger('click')
    expect(wrapper.get('[data-test=minus]').classes()).toContain('is-flash')
  })
})
