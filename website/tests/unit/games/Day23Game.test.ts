import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day23Game from '@/presentation/games/days/Day23Game.vue'

async function assign(wrapper: VueWrapper, card: string, slot: string) {
  await wrapper.get(`[data-card=${card}]`).trigger('click')
  await wrapper.get(`[data-slot=${slot}]`).trigger('click')
}

describe('Day23Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('用名字、Secret 引用、PVC 接好後撐過三場測試，按收下這一課只 emit complete 一次', async () => {
    const wrapper = mount(Day23Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    expect(wrapper.get('[data-test=chaos]').attributes('disabled')).toBeDefined()
    await assign(wrapper, 'name', 'host')
    await assign(wrapper, 'secret', 'password')
    await assign(wrapper, 'pvc', 'data')
    await wrapper.get('[data-test=chaos]').trigger('click')
    await vi.advanceTimersByTimeAsync(6000)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('填 IP 和明文密碼會在混沌測試失敗，可直接改卡重測', async () => {
    const wrapper = mount(Day23Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await assign(wrapper, 'ip', 'host')
    await assign(wrapper, 'plain', 'password')
    await assign(wrapper, 'pvc', 'data')
    await wrapper.get('[data-test=chaos]').trigger('click')
    await vi.advanceTimersByTimeAsync(6000)

    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
    expect(wrapper.get('[data-result="0"]').text()).toContain('失敗')
    expect(wrapper.get('[data-result="1"]').text()).toContain('失敗')
    expect(wrapper.get('[data-result="2"]').text()).toContain('通過')

    await assign(wrapper, 'name', 'host')
    await assign(wrapper, 'secret', 'password')
    await wrapper.get('[data-test=chaos]').trigger('click')
    await vi.advanceTimersByTimeAsync(6000)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(true)
  })

  it('卡片放到不對應的槽會被擋下', async () => {
    const wrapper = mount(Day23Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await assign(wrapper, 'empty', 'host')
    expect(wrapper.get('[data-slot=host]').text()).not.toContain('emptyDir')
    expect(wrapper.get('[role=status]').text()).not.toBe('')
  })

  it('重測時資料庫泡泡從舊 IP 重來；同一張卡連放錯 2 次會閃正確的槽', async () => {
    const wrapper = mount(Day23Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-card=pvc]').trigger('click')
    await wrapper.get('[data-slot=host]').trigger('click')
    expect(wrapper.find('.slot.is-flash').exists()).toBe(false)
    await wrapper.get('[data-slot=password]').trigger('click')
    expect(wrapper.get('[data-slot=data]').classes()).toContain('is-flash')
    await wrapper.get('[data-slot=data]').trigger('click')

    await assign(wrapper, 'ip', 'host')
    await assign(wrapper, 'secret', 'password')
    await wrapper.get('[data-test=chaos]').trigger('click')
    await vi.advanceTimersByTimeAsync(6000)
    expect(wrapper.text()).toContain('10.244.2.9')

    await wrapper.get('[data-test=chaos]').trigger('click')
    expect(wrapper.text()).toContain('10.244.1.5')
    expect(wrapper.text()).not.toContain('10.244.2.9')
  })
})
