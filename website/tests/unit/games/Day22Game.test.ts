import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day22Game from '@/presentation/games/days/Day22Game.vue'

async function bind(wrapper: VueWrapper, slip: string, pv: string) {
  await wrapper.get(`[data-slip=${slip}]`).trigger('click')
  await wrapper.get(`[data-pv=${pv}]`).trigger('click')
}

describe('Day22Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('夠用但不是最小的倉庫會被拒絕；泡泡指向倉庫也不對', async () => {
    const wrapper = mount(Day22Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await bind(wrapper, 'db', 'c')
    expect(wrapper.get('[role=status]').text()).toContain('最小')
    await bind(wrapper, 'db', 'a')
    expect(wrapper.get('[role=status]').text()).toContain('小')
    expect(wrapper.find('[data-test=bound-db]').exists()).toBe(false)

    await bind(wrapper, 'db', 'd')
    await bind(wrapper, 'log', 'b')
    await bind(wrapper, 'cache', 'a')
    await vi.advanceTimersByTimeAsync(1500)
    await wrapper.get('[data-pv=d]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('借用單')
    expect(wrapper.find('[data-choice]').exists()).toBe(false)
  })

  it('綁定、指向、回收三段完成，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day22Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await bind(wrapper, 'log', 'b')
    await bind(wrapper, 'db', 'd')
    await bind(wrapper, 'cache', 'a')
    await vi.advanceTimersByTimeAsync(1500)
    await wrapper.get('[data-slip=db]').trigger('click')
    await vi.advanceTimersByTimeAsync(1500)
    await wrapper.get('[data-choice=released]').trigger('click')
    expect(wrapper.text()).toContain('Released')
    await vi.advanceTimersByTimeAsync(3000)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('綁完到下一段的空窗期點擊不跳錯；指向階段連錯 2 次會閃 db 借用單', async () => {
    const wrapper = mount(Day22Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await bind(wrapper, 'db', 'd')
    await bind(wrapper, 'log', 'b')
    await bind(wrapper, 'cache', 'a')
    await wrapper.get('[data-pv=c]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('全部綁好')

    await vi.advanceTimersByTimeAsync(1100)
    await wrapper.get('[data-pv=c]').trigger('click')
    expect(wrapper.find('[data-slip=db].is-flash').exists()).toBe(false)
    await wrapper.get('[data-slip=log]').trigger('click')
    expect(wrapper.find('[data-slip=db].is-flash').exists()).toBe(true)

    await wrapper.get('[data-slip=db]').trigger('click')
    await wrapper.get('[data-pv=c]').trigger('click')
    expect(wrapper.get('[role=status]').text()).toContain('借用單的名字')
  })
})
