import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day29Game from '@/presentation/games/days/Day29Game.vue'

const LINES = [
  ['whistle', 'lighthouse', 'memory-tree'],
  ['patrol-captain', 'steward', 'owl', 'tree-picker', 'lighthouse'],
  ['squirrel', 'bubble', 'bird', 'ready-flag'],
  ['gate-map', 'totem', 'road-keeper', 'bubble', 'bird'],
  ['bird', 'borrow-slip', 'warehouse'],
]

const tap = (wrapper: VueWrapper, id: string) => wrapper.get(`[data-role=${id}]`).trigger('click')

describe('Day29Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('每條線只開放本線角色加兩個干擾角色，點干擾角色會說明原因', async () => {
    const wrapper = mount(Day29Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    expect(wrapper.get('[data-role=food-bucket]').attributes('disabled')).toBeDefined()
    const clickable = wrapper.findAll('[data-role]').filter((w) => w.attributes('disabled') === undefined)
    expect(clickable).toHaveLength(LINES[0]!.length + 2)

    await tap(wrapper, 'tree-picker')
    expect(wrapper.get('[role=status]').text()).toContain('選樹官')
    await tap(wrapper, 'lighthouse')
    expect(wrapper.findAll('[data-test=line-done]')).toHaveLength(0)
  })

  it('接通五條線並答對停電兩題後，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day29Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (const line of LINES) {
      for (const id of line) await tap(wrapper, id)
      await vi.advanceTimersByTimeAsync(1500)
    }
    expect(wrapper.findAll('[data-test=line-done]')).toHaveLength(5)

    await wrapper.get('[data-choice=yes]').trigger('click')
    await vi.advanceTimersByTimeAsync(1500)
    await wrapper.get('[data-choice=no]').trigger('click')
    await vi.advanceTimersByTimeAsync(1500)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})
