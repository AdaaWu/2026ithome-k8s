import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day18Game from '@/presentation/games/days/Day18Game.vue'

async function start() {
  const wrapper = mount(Day18Game)
  await wrapper.get('[data-test=shell-start]').trigger('click')
  return wrapper
}

async function tapAll(wrapper: Awaited<ReturnType<typeof start>>, selectors: string[]) {
  for (const s of selectors) await wrapper.get(s).trigger('click')
}

describe('Day18Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('錯的道路管理員只提示，不會前進；不在路線上的角色停用', async () => {
    const wrapper = await start()
    expect(wrapper.get('[data-node=lighthouse]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-node=deco1]').attributes('disabled')).toBeDefined()
    await tapAll(wrapper, ['[data-node=gate-map]', '[data-node=gatekeeper]', '[data-node=totem]'])
    await wrapper.get('[data-node=road-b]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('出發')
    expect(wrapper.find('[data-ep]').attributes('disabled')).toBeDefined()
  })

  it('還沒輪到柱子就點柱子，提示先走前一站', async () => {
    const wrapper = await start()
    await wrapper.get('[data-node=totem]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toBe('還沒輪到柱子，先走前一站')
  })

  it('同一畫面可點目標不超過 12 個，第 2 團停用守門員與看板', async () => {
    const wrapper = await start()
    const tappable = () => wrapper.findAll('button:not([disabled])').filter((b) => b.attributes('data-node') || b.attributes('data-ep'))
    expect(tappable().length).toBeLessThanOrEqual(12)
    await tapAll(wrapper, ['[data-node=gate-map]', '[data-node=gatekeeper]', '[data-node=totem]', '[data-node=road-a]'])
    expect(tappable().length).toBeLessThanOrEqual(12)
    await wrapper.get('[data-ep=p2]').trigger('click')
    await tapAll(wrapper, ['[data-node=tree-b]', '[data-node=p2]', '[data-node=bird]'])
    await vi.advanceTimersByTimeAsync(1500)
    expect(wrapper.get('[data-node=gatekeeper]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-node=gate-map]').attributes('disabled')).toBeDefined()
  })

  it('兩回合都把柱子當查名單，走完後過關，complete 只發一次', async () => {
    const wrapper = await start()
    await tapAll(wrapper, ['[data-node=gate-map]', '[data-node=gatekeeper]', '[data-node=totem]', '[data-node=road-a]'])
    await wrapper.get('[data-ep=p2]').trigger('click')
    expect(wrapper.get('[data-test=packet]').text()).toContain('10.244.2.7')
    await tapAll(wrapper, ['[data-node=tree-b]', '[data-node=p2]', '[data-node=bird]'])
    await vi.advanceTimersByTimeAsync(1500)

    await tapAll(wrapper, ['[data-node=p1]', '[data-node=totem]', '[data-node=road-a]'])
    await wrapper.get('[data-ep=p1]').trigger('click')
    await tapAll(wrapper, ['[data-node=tree-a]', '[data-node=p1]', '[data-node=bird]'])
    await vi.advanceTimersByTimeAsync(1500)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})
