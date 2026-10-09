import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day11Game from '@/presentation/games/days/Day11Game.vue'

async function playToRollback() {
  const wrapper = mount(Day11Game)
  await wrapper.get('[data-test=shell-start]').trigger('click')
  for (const id of ['s1-no', 's2-yes', 's3-yes']) {
    await wrapper.get(`[data-choice=${id}]`).trigger('click')
    await vi.advanceTimersByTimeAsync(4000)
  }
  return wrapper
}

describe('Day11Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('改 replicas 不會讓卷軸多一行，改 image 會', async () => {
    const wrapper = mount(Day11Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await wrapper.get('[data-choice=s1-yes]').trigger('click')
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.findAll('[data-rev]')).toHaveLength(1)

    await wrapper.get('[data-choice=s2-yes]').trigger('click')
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.findAll('[data-rev]')).toHaveLength(2)
  })

  it('捲回壞掉的 rev3 或太舊的 rev1 都不會過關', async () => {
    const wrapper = await playToRollback()
    await wrapper.get('[data-rev="3"]').trigger('click')
    await wrapper.get('[data-rev="1"]').trigger('click')
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
    expect(wrapper.find('[data-rev="2"]').exists()).toBe(true)
  })

  it('捲回 rev2 會變成 rev4，按收下這一課會 emit complete 一次', async () => {
    const wrapper = await playToRollback()
    await wrapper.get('[data-rev="2"]').trigger('click')
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.find('[data-rev="2"]').exists()).toBe(false)
    expect(wrapper.find('[data-rev="4"]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('捲回階段連錯 2 次就閃正確的 rev2', async () => {
    const wrapper = await playToRollback()
    await wrapper.get('[data-rev="3"]').trigger('click')
    expect(wrapper.get('[data-rev="2"]').classes()).not.toContain('is-flash')
    await wrapper.get('[data-rev="1"]').trigger('click')
    expect(wrapper.get('[data-rev="2"]').classes()).toContain('is-flash')
  })

  it('改 replicas 的提示用中文角色名', async () => {
    const wrapper = mount(Day11Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await wrapper.get('[data-choice=s1-no]').trigger('click')
    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.get('[role=status]').text()).toBe('貓頭鷹變 3 顆，卷軸沒變')
  })
})
