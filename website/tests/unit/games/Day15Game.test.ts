import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day15Game from '@/presentation/games/days/Day15Game.vue'

const ANSWERS = ['cluster', 'node', 'lb', 'pf']

async function start() {
  const wrapper = mount(Day15Game)
  await wrapper.get('[data-test=shell-start]').trigger('click')
  return wrapper
}

describe('Day15Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('開太多層會被判錯並提示攻擊面', async () => {
    const wrapper = await start()
    await wrapper.get('[data-choice=lb]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('攻擊面')
  })

  it('錯 2 回合就失敗，再玩一次回到第 1 回合', async () => {
    const wrapper = await start()
    for (const [i, right] of ANSWERS.slice(0, 2).entries()) {
      await wrapper.get(`[data-choice=${i === 0 ? 'node' : 'cluster'}]`).trigger('click')
      await wrapper.get(`[data-choice=${right}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1500)
    }
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.get('[data-test=round]').text()).toContain('1')
  })

  it('四回合都選最小夠用的型號就過關，complete 只發一次', async () => {
    const wrapper = await start()
    for (const id of ANSWERS) {
      await wrapper.get(`[data-choice=${id}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1500)
    }
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('第 2 回合答錯後立刻鎖住選項，retry 後舊計時不會把新局翻回 lost', async () => {
    const wrapper = await start()
    await wrapper.get('[data-choice=node]').trigger('click')
    await wrapper.get('[data-choice=cluster]').trigger('click')
    await vi.advanceTimersByTimeAsync(1500)
    await wrapper.get('[data-choice=cluster]').trigger('click')
    expect(wrapper.get('[data-choice=node]').element.closest('fieldset')?.disabled).toBe(true)
    await vi.advanceTimersByTimeAsync(1500)
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    await wrapper.get('[data-choice=cluster]').trigger('click')
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.get('[data-test=round]').text()).toBe('第 2 回合')
  })

  it('同一回合錯 2 次就閃正確選項', async () => {
    const wrapper = await start()
    for (const id of ['cluster', 'node', 'lb']) {
      await wrapper.get(`[data-choice=${id}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1500)
    }
    await wrapper.get('[data-choice=lb]').trigger('click')
    expect(wrapper.find('fieldset[data-flash]').exists()).toBe(false)
    await wrapper.get('[data-choice=node]').trigger('click')
    expect(wrapper.get('fieldset').attributes('data-flash')).toBe('pf')
  })
})
