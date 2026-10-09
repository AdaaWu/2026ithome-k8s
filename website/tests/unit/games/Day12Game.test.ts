import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day12Game from '@/presentation/games/days/Day12Game.vue'

// 病患 → 該用的工具與正確診斷
const CURE: Record<string, { tool: string; diagnosis: string }> = {
  pull: { tool: 'describe', diagnosis: 'image' },
  crash: { tool: 'previous', diagnosis: 'config' },
  pending: { tool: 'describe', diagnosis: 'node' },
}

const patientOf = (wrapper: VueWrapper) => wrapper.get('[data-patient]').attributes('data-patient')!

describe('Day12Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('三位病患都用對工具並診斷正確，按收下這一課只 emit complete 一次', async () => {
    const wrapper = mount(Day12Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (let i = 0; i < 3; i++) {
      const cure = CURE[patientOf(wrapper)]!
      expect(wrapper.find('[data-choice]').exists()).toBe(false)
      await wrapper.get(`[data-tool=${cure.tool}]`).trigger('click')
      await wrapper.get(`[data-choice=${cure.diagnosis}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1500)
    }

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('一直亂點工具超過 7 次檢查就失敗，再玩一次可回到遊戲', async () => {
    const wrapper = mount(Day12Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (let i = 0; i < 7; i++) await wrapper.get('[data-tool=logs]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    await wrapper.get('[data-tool=logs]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.get('[data-test=checks]').text()).toBe('檢查 0/7')
  })

  it('失敗後 retry，舊的延遲回呼不會改到新局', async () => {
    const wrapper = mount(Day12Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    const pick = patientOf(wrapper) === 'crash' ? 'describe' : 'logs'
    for (let i = 0; i < 8; i++) await wrapper.get(`[data-tool=${pick}]`).trigger('click')
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.find('.tools__btn.shake').exists()).toBe(false)
    expect(wrapper.find('.is-flash').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.get('[data-test=checks]').text()).toBe('檢查 0/7')
  })

  it('同一位病患用錯工具 2 次就閃正確工具', async () => {
    const wrapper = mount(Day12Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    const cure = CURE[patientOf(wrapper)]!
    const wrong = cure.tool === 'describe' ? 'logs' : 'describe'
    await wrapper.get(`[data-tool=${wrong}]`).trigger('click')
    expect(wrapper.get(`[data-tool=${cure.tool}]`).classes()).not.toContain('is-flash')
    await wrapper.get(`[data-tool=${wrong}]`).trigger('click')
    expect(wrapper.get(`[data-tool=${cure.tool}]`).classes()).toContain('is-flash')
  })

  it('同一位病患診斷錯 2 次就閃正確診斷', async () => {
    const wrapper = mount(Day12Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    const cure = CURE[patientOf(wrapper)]!
    await wrapper.get(`[data-tool=${cure.tool}]`).trigger('click')
    const wrongs = ['image', 'config', 'node'].filter((d) => d !== cure.diagnosis)
    await wrapper.get(`[data-choice=${wrongs[0]}]`).trigger('click')
    expect(wrapper.get('.diagnose').attributes('data-flash')).toBeUndefined()
    await wrapper.get(`[data-choice=${wrongs[1]}]`).trigger('click')
    expect(wrapper.get('.diagnose').attributes('data-flash')).toBe(cure.diagnosis)
  })
})
