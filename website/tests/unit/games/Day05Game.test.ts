import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day05Game from '@/presentation/games/days/Day05Game.vue'

// 任務 id → 正解的動詞與旗標
const ANSWER: Record<string, { verb: string; flag?: string }> = {
  'list-default': { verb: 'get' },
  'list-dev': { verb: 'get', flag: '-n dev' },
  'list-all': { verb: 'get', flag: '-A' },
  events: { verb: 'describe' },
  logs: { verb: 'logs' },
  apply: { verb: 'apply' },
  forward: { verb: 'port-forward' },
  yaml: { verb: 'get', flag: '-o yaml' },
  exec: { verb: 'exec' },
  delete: { verb: 'delete' },
}

async function solveCurrent(wrapper: VueWrapper) {
  const { verb, flag } = ANSWER[wrapper.get('[data-task]').attributes('data-task')!]!
  await wrapper.get(`[data-verb="${verb}"]`).trigger('click')
  if (flag) await wrapper.get(`[data-flag="${flag}"]`).trigger('click')
  await wrapper.get('[data-test=blow]').trigger('click')
  await vi.advanceTimersByTimeAsync(900)
}

describe('Day05Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('需要旗標卻沒加，會回真實輸出且不前進', async () => {
    const wrapper = mount(Day05Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    // 10 張抽 8 張，3 張要旗標的任務至少會出現 1 張
    let solved = 0
    while (!ANSWER[wrapper.get('[data-task]').attributes('data-task')!]!.flag) {
      await solveCurrent(wrapper)
      solved++
    }
    const { flag } = ANSWER[wrapper.get('[data-task]').attributes('data-task')!]!

    await wrapper.get('[data-verb=get]').trigger('click')
    await wrapper.get('[data-test=blow]').trigger('click')
    await vi.advanceTimersByTimeAsync(900)
    expect(wrapper.get('[data-test=terminal]').text()).toContain('hello')
    expect(wrapper.get('[role=status]').text()).toContain(flag)
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(solved)
  })

  it('連錯 2 次會閃出正解的動詞', async () => {
    const wrapper = mount(Day05Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    const { verb } = ANSWER[wrapper.get('[data-task]').attributes('data-task')!]!
    const wrong = verb === 'delete' ? 'logs' : 'delete'

    await wrapper.get(`[data-verb="${wrong}"]`).trigger('click')
    await wrapper.get('[data-test=blow]').trigger('click')
    expect(wrapper.get(`[data-verb="${verb}"]`).classes()).not.toContain('is-flash')
    await wrapper.get(`[data-verb="${wrong}"]`).trigger('click')
    await wrapper.get('[data-test=blow]').trigger('click')
    expect(wrapper.get(`[data-verb="${verb}"]`).classes()).toContain('is-flash')
  })

  it('蓋章到換下一張之間不扣時間', async () => {
    const wrapper = mount(Day05Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await vi.advanceTimersByTimeAsync(1000)
    const before = wrapper.get('[data-test=shell-timer]').attributes('style')

    const { verb, flag } = ANSWER[wrapper.get('[data-task]').attributes('data-task')!]!
    await wrapper.get(`[data-verb="${verb}"]`).trigger('click')
    if (flag) await wrapper.get(`[data-flag="${flag}"]`).trigger('click')
    await wrapper.get('[data-test=blow]').trigger('click')
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.get('[data-test=shell-timer]').attributes('style')).toBe(before)
  })

  it('動詞選錯不會蓋章，指令預覽也不留下錯的動詞', async () => {
    const wrapper = mount(Day05Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    const { verb } = ANSWER[wrapper.get('[data-task]').attributes('data-task')!]!
    const wrong = verb === 'delete' ? 'logs' : 'delete'

    await wrapper.get(`[data-verb="${wrong}"]`).trigger('click')
    await wrapper.get('[data-test=blow]').trigger('click')
    await vi.advanceTimersByTimeAsync(900)
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(0)
    expect(wrapper.get('.cmd').text()).toContain('kubectl ___')
    expect(wrapper.get('.cmd').text()).not.toContain(wrong)
  })

  it('時間到先延長一次，第二次才失敗', async () => {
    const wrapper = mount(Day05Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await vi.advanceTimersByTimeAsync(76_000)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(21_000)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)
  })

  it('完成 8 張任務單後，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day05Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (let i = 0; i < 8; i++) await solveCurrent(wrapper)
    await vi.advanceTimersByTimeAsync(1500)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('失敗後重來，回到第 1 張任務單並重新計時', async () => {
    const wrapper = mount(Day05Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await solveCurrent(wrapper)
    await vi.advanceTimersByTimeAsync(97_000)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
    await solveCurrent(wrapper)
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(1)
  })
})
