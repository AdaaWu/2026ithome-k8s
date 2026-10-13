import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day10Game from '@/presentation/games/days/Day10Game.vue'

describe('Day10Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('新的還沒 Ready 就先收舊的會失敗，再玩一次可重來', async () => {
    const wrapper = mount(Day10Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-test=remove-old]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.findAll('[data-pod=v1]')).toHaveLength(3)
  })

  it('maxSurge 1：總數到 4 顆時不能再加', async () => {
    const wrapper = mount(Day10Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-test=add-new]').trigger('click')
    await wrapper.get('[data-test=add-new]').trigger('click')
    expect(wrapper.findAll('[data-pod=v2]')).toHaveLength(1)
    expect(wrapper.get('[role=status]').text()).toContain('maxSurge')
  })

  it('新泡泡還沒 Ready 時連錯不閃收舊，Ready 後才閃', async () => {
    const wrapper = mount(Day10Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-test=add-new]').trigger('click')
    await wrapper.get('[data-test=add-new]').trigger('click')
    await wrapper.get('[data-test=add-new]').trigger('click')
    expect(wrapper.get('[data-test=remove-old]').classes()).not.toContain('is-flash')
    expect(wrapper.get('[data-test=add-new]').classes()).not.toContain('is-flash')

    await vi.advanceTimersByTimeAsync(1600)
    expect(wrapper.get('[data-test=remove-old]').classes()).toContain('is-flash')
  })

  it('加新、等就緒、收舊三輪後過關，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day10Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (let i = 0; i < 3; i++) {
      await wrapper.get('[data-test=add-new]').trigger('click')
      await vi.advanceTimersByTimeAsync(1600)
      await wrapper.get('[data-test=remove-old]').trigger('click')
    }
    await vi.advanceTimersByTimeAsync(1500)
    expect(wrapper.get('[data-test=old-owl]').text()).toContain('0')

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('失敗後重來，上一局等待中的就緒回呼不會改到新局', async () => {
    const wrapper = mount(Day10Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-test=add-new]').trigger('click')
    await wrapper.get('[data-test=add-new]').trigger('click')
    await wrapper.get('[data-test=remove-old]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.get('[data-test=add-new]').classes()).not.toContain('shake')
    expect(wrapper.findAll('[data-pod=v2]')).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1000)
    await wrapper.get('[data-test=add-new]').trigger('click')
    // 上一局的回呼在第 1.5 秒觸發，新局的泡泡要再等 1.5 秒才 Ready
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.find('[role=status]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.get('[role=status]').text()).toContain('Ready')
  })

  it('換裝完成到過關之間，按鈕不會跳錯誤提示', async () => {
    const wrapper = mount(Day10Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    for (let i = 0; i < 3; i++) {
      await wrapper.get('[data-test=add-new]').trigger('click')
      await vi.advanceTimersByTimeAsync(1600)
      await wrapper.get('[data-test=remove-old]').trigger('click')
    }

    await wrapper.get('[data-test=remove-old]').trigger('click')
    await wrapper.get('[data-test=add-new]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('沒被刪')
    expect(wrapper.get('[data-test=add-new]').classes()).not.toContain('shake')
    await vi.advanceTimersByTimeAsync(1300)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(true)
  })
})
