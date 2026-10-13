import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day27Game from '@/presentation/games/days/Day27Game.vue'

describe('Day27Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('跳號或前一顆還沒 Ready 就建下一顆會被拒絕', async () => {
    const wrapper = mount(Day27Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-slot="1"]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('OrderedReady')
    // 抖動時仍保留空位樣式
    expect(wrapper.get('[data-slot="1"]').classes()).toEqual(expect.arrayContaining(['kchar--shake', 'is-ghost']))
    await wrapper.get('[data-slot="0"]').trigger('click')
    await wrapper.get('[data-slot="1"]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('Ready 才建')
    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.get('[data-slot="1"]').classes()).toContain('kchar--ghost')
  })

  it('依序建立、接回倉庫、選對地址、縮容選對編號後，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day27Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (const slot of ['0', '1', '2']) {
      await wrapper.get(`[data-slot="${slot}"]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1600)
    }
    await vi.advanceTimersByTimeAsync(2000)

    await wrapper.get('[data-slot="1"]').trigger('click')
    await wrapper.get('[data-warehouse="0"]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('自己那座')
    await wrapper.get('[data-warehouse="1"]').trigger('click')
    await vi.advanceTimersByTimeAsync(2500)

    await wrapper.get('[data-choice=pod-dns]').trigger('click')
    await vi.advanceTimersByTimeAsync(1500)

    await wrapper.get('[data-slot="2"]').trigger('click')
    await vi.advanceTimersByTimeAsync(2500)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('卡關保護：同一步錯 1 次不閃，錯 2 次閃正確目標', async () => {
    const wrapper = mount(Day27Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-slot="2"]').trigger('click')
    expect(wrapper.find('.is-flash').exists()).toBe(false)
    await wrapper.get('[data-slot="1"]').trigger('click')
    expect(wrapper.get('[data-slot="0"]').classes()).toContain('is-flash')

    for (const slot of ['0', '1', '2']) {
      await wrapper.get(`[data-slot="${slot}"]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1600)
    }
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.find('.is-flash').exists()).toBe(false)

    await wrapper.get('[data-slot="1"]').trigger('click')
    await wrapper.get('[data-warehouse="0"]').trigger('click')
    await wrapper.get('[data-warehouse="2"]').trigger('click')
    expect(wrapper.get('[data-warehouse="1"]').classes()).toContain('is-flash')
  })
})
