import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day04Game from '@/presentation/games/days/Day04Game.vue'

const ROUND1 = ['whistle', 'lighthouse', 'patrol-captain', 'lighthouse', 'tree-picker', 'lighthouse', 'squirrel']
const ROUND2 = ['patrol-captain', 'lighthouse', 'tree-picker', 'lighthouse', 'squirrel']

const tap = (wrapper: VueWrapper, id: string) => wrapper.get(`[data-role=${id}]`).trigger('click')

describe('Day04Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('跳過櫃台直接找選樹官會被擋下並說明原因', async () => {
    const wrapper = mount(Day04Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await tap(wrapper, 'whistle')
    await tap(wrapper, 'tree-picker')
    expect(wrapper.get('[role=status]').text()).toContain('繞過櫃台')
    await tap(wrapper, 'memory-tree')
    expect(wrapper.get('[role=status]').text()).toContain('記憶樹只跟櫃台說話')
    expect(wrapper.findAll('[data-test=pod]')).toHaveLength(0)
  })

  it('兩回合依序傳遞後，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day04Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (const id of ROUND1) await tap(wrapper, id)
    expect(wrapper.text()).toContain('櫃台已登記：要 3 顆泡泡')
    await vi.advanceTimersByTimeAsync(1500)
    expect(wrapper.findAll('[data-test=pod]')).toHaveLength(3)

    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.findAll('[data-test=pod]')).toHaveLength(2)
    for (const id of ROUND2) await tap(wrapper, id)
    await vi.advanceTimersByTimeAsync(3000)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('同一步連錯 2 次，閃出該點的角色', async () => {
    const wrapper = mount(Day04Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await tap(wrapper, 'squirrel')
    expect(wrapper.get('[data-role=whistle]').classes()).not.toContain('is-flash')
    await tap(wrapper, 'tree-picker')
    expect(wrapper.get('[data-role=whistle]').classes()).toContain('is-flash')
    await tap(wrapper, 'whistle')
    expect(wrapper.find('.is-flash').exists()).toBe(false)
  })
})
