import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day08Game from '@/presentation/games/days/Day08Game.vue'

// 三回合的正解，依 specs/05 刪掉 api-d4 與 hello-g7 後的資料
const ROUNDS = [
  ['hello-a1', 'hello-b2', 'hello-c3', 'web-i9'],
  ['hello-a1', 'hello-c3', 'web-i9'],
  ['db-h8'],
]

async function pickAndShine(wrapper: VueWrapper, pods: string[]) {
  for (const pod of pods) await wrapper.get(`[data-pod=${pod}]`).trigger('click')
  await wrapper.get('[data-test=shine]').trigger('click')
}

describe('Day08Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('三回合都選對，按收下這一課只 emit complete 一次', async () => {
    const wrapper = mount(Day08Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (const answer of ROUNDS) {
      await pickAndShine(wrapper, answer)
      await vi.advanceTimersByTimeAsync(1500)
    }

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('多選大小寫不同的 Hello 會被指出，第 2 次閃正解，連錯 3 次才失敗', async () => {
    const wrapper = mount(Day08Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await pickAndShine(wrapper, [...ROUNDS[0]!, 'hello-e5'])
    expect(wrapper.get('[role=status]').text()).toContain('Hello')
    expect(wrapper.find('.is-flash').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(600)
    await wrapper.get('[data-pod=hello-a1]').trigger('click')
    await wrapper.get('[data-test=shine]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.get('[data-pod=hello-a1]').classes()).toContain('is-flash')

    await wrapper.get('[data-pod=hello-f6]').trigger('click')
    await wrapper.get('[data-test=shine]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)
  })

  it('失敗後重來，上一局的搖晃與次數不會帶進新局', async () => {
    const wrapper = mount(Day08Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    for (let i = 0; i < 3; i++) await pickAndShine(wrapper, ['hello-f6'])
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.find('.is-flash').exists()).toBe(false)
    expect(wrapper.get('[data-test=shine]').text()).toContain('已選 0 顆')
    await vi.advanceTimersByTimeAsync(1000)

    await pickAndShine(wrapper, ROUNDS[0]!)
    await vi.advanceTimersByTimeAsync(1500)
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(1)
  })

  it('同時選錯兩個陷阱會兩個都解釋，剩餘機會跟著減少', async () => {
    const wrapper = mount(Day08Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    expect(wrapper.get('[data-test=tries-left]').text()).toBe('3')

    await pickAndShine(wrapper, [...ROUNDS[0]!, 'hello-e5', 'hello-f6'])
    const text = wrapper.get('[role=status]').text()
    expect(text).toContain('Hello')
    expect(text).toContain('api')
    expect(wrapper.get('[data-test=tries-left]').text()).toBe('2')
  })
})
