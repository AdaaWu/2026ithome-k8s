import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day25Game from '@/presentation/games/days/Day25Game.vue'

const tapTree = (wrapper: VueWrapper, id: string) => wrapper.get(`[data-tree=${id}]`).trigger('click')

describe('Day25Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('Request 塞不下會報 Insufficient，錯超過 2 次判失敗', async () => {
    const wrapper = mount(Day25Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await tapTree(wrapper, 'C')
    // 1000m / 2Gi，樹 B 記憶體只剩 1Gi
    await tapTree(wrapper, 'B')
    expect(wrapper.get('[role=status]').text()).toContain('Insufficient memory')
    // 還有樹放得下卻判 Pending
    await wrapper.get('[data-test=pending-btn]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    await tapTree(wrapper, 'B')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)
  })

  it('6 顆都判對並答對 Limit 兩題後，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day25Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (const tree of ['A', 'C', 'A', 'C', 'B']) {
      await tapTree(wrapper, tree)
      await vi.advanceTimersByTimeAsync(300)
    }
    await wrapper.get('[data-test=pending-btn]').trigger('click')
    await vi.advanceTimersByTimeAsync(1200)

    await wrapper.get('[data-choice=throttle]').trigger('click')
    await vi.advanceTimersByTimeAsync(1500)
    await wrapper.get('[data-choice=oom]').trigger('click')
    await vi.advanceTimersByTimeAsync(2500)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('失敗後重來，舊局的延遲回呼不會改到新局', async () => {
    const wrapper = mount(Day25Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    for (let i = 0; i < 3; i++) await wrapper.get('[data-test=pending-btn]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.get('[data-test=pending-btn]').classes()).not.toContain('shake')
    expect(wrapper.text()).toContain('錯 0 / 2')
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.text()).toContain('待排程 1 / 6')
    await tapTree(wrapper, 'C')
    expect(wrapper.text()).toContain('待排程 2 / 6')
  })
})
