import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day21Game from '@/presentation/games/days/Day21Game.vue'

async function saveOne(wrapper: VueWrapper) {
  await wrapper.get('[data-file]:not([disabled])').trigger('click')
}

describe('Day21Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('沒有倒數；猜錯兩次正解會閃；容器重啟清空肚子、食物桶不動、泡泡名字不變', async () => {
    const wrapper = mount(Day21Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    expect(wrapper.find('[data-test=shell-timer]').exists()).toBe(false)

    await saveOne(wrapper)
    await saveOne(wrapper)
    expect(wrapper.findAll('[data-file]').length).toBeGreaterThan(0)
    expect(wrapper.get('[data-file]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-choice=bucket]').trigger('click')
    expect(wrapper.find('.quiz.is-stuck').exists()).toBe(false)
    await wrapper.get('[data-choice=both]').trigger('click')
    expect(wrapper.find('.quiz.is-stuck').exists()).toBe(true)

    await wrapper.get('[data-choice=belly]').trigger('click')
    expect(wrapper.get('[data-test=restarts]').text()).toBe('1')
    await vi.advanceTimersByTimeAsync(1400)
    expect(wrapper.get('[data-test=bucket]').text()).toBe('食物桶存了 2 / 5 份')
    expect(wrapper.get('[data-test=pod-name]').text()).toBe('upload-7f9c-abcde')
    expect(wrapper.get('[data-test=lost]').text()).toContain('弄丟')
  })

  it('第二次重啟前搶救的檔案保住，計數不超過目標；泡泡被替換後桶清空，emit complete 一次', async () => {
    const wrapper = mount(Day21Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await saveOne(wrapper)
    await saveOne(wrapper)
    await wrapper.get('[data-choice=belly]').trigger('click')
    await vi.advanceTimersByTimeAsync(3000)

    // 存到第 4 份觸發突襲重啟，警告期間還能搶救
    await saveOne(wrapper)
    await saveOne(wrapper)
    await saveOne(wrapper)
    await vi.advanceTimersByTimeAsync(1300)
    expect(wrapper.get('[data-test=restarts]').text()).toBe('2')
    expect(wrapper.get('[data-test=bucket]').text()).toBe('食物桶存了 5 / 5 份')
    await vi.advanceTimersByTimeAsync(1400)

    expect(wrapper.find('[data-file]').exists()).toBe(false)
    await wrapper.get('[data-choice=move]').trigger('click')
    await wrapper.get('[data-choice=gone]').trigger('click')
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.get('[data-test=pod-name]').text()).toBe('upload-7f9c-xk2mp')
    expect(wrapper.get('[data-test=bucket]').text()).toBe('食物桶存了 0 / 5 份')
    await vi.advanceTimersByTimeAsync(2000)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})
