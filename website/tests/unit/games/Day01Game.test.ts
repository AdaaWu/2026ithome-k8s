import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day01Game from '@/presentation/games/days/Day01Game.vue'

describe('Day01Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('開局第 1 秒就倒樹，小鳥不能放回倒下的樹', async () => {
    const wrapper = mount(Day01Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await vi.advanceTimersByTimeAsync(1100)

    const grounded = wrapper.findAll('[data-test=ground-bird]')
    expect(grounded).toHaveLength(2)
    await grounded[0]!.trigger('click')
    await wrapper.get('[data-tree=A]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('倒了')
    expect(wrapper.findAll('[data-test=ground-bird]')).toHaveLength(2)

    await wrapper.get('[data-tree=B]').trigger('click')
    expect(wrapper.findAll('[data-test=ground-bird]')).toHaveLength(1)
  })

  it('宣告後推倒兩棵樹，島自己補回 6 個並過關，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day01Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await vi.advanceTimersByTimeAsync(15_500)

    await wrapper.get('[data-test=declare]').trigger('click')
    expect(wrapper.findAll('[data-test=pod]')).toHaveLength(6)

    await wrapper.get('[data-tree=A]').trigger('click')
    await vi.advanceTimersByTimeAsync(2500)
    expect(wrapper.findAll('[data-test=pod]')).toHaveLength(6)

    // 第二棵倒下時第一棵還沒長回來，多出來的泡泡先 Pending
    await wrapper.get('[data-tree=B]').trigger('click')
    await vi.advanceTimersByTimeAsync(2200)
    expect(wrapper.findAll('[data-test=pending]').length).toBeGreaterThan(0)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.findAll('[data-test=pending]')).toHaveLength(0)
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('同一步連錯 2 次，閃出能放的樹；放對後停止', async () => {
    const wrapper = mount(Day01Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await vi.advanceTimersByTimeAsync(1100)

    await wrapper.findAll('[data-test=ground-bird]')[0]!.trigger('click')
    await wrapper.get('[data-tree=A]').trigger('click')
    expect(wrapper.find('.is-flash').exists()).toBe(false)
    await wrapper.get('[data-tree=A]').trigger('click')
    expect(wrapper.get('[data-tree=B]').classes()).toContain('is-flash')

    await wrapper.get('[data-tree=B]').trigger('click')
    expect(wrapper.find('.is-flash').exists()).toBe(false)
  })
})
