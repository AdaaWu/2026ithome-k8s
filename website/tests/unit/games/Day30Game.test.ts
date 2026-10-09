import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day30Game from '@/presentation/games/days/Day30Game.vue'

const ANSWERS = ['previous', 'clusterip', 'undo', 'pvc', 'readiness']
const WRONGS = ['delete', 'nodeport', 'wait']

describe('Day30Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('五題全對後全員合照，按收下這一課只 emit complete 一次', async () => {
    const wrapper = mount(Day30Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (const id of ANSWERS) {
      await wrapper.get(`[data-choice=${id}]`).trigger('click')
      await wrapper.get('[data-test=next]').trigger('click')
    }
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(4000)

    expect(wrapper.findAll('[data-test=photo] > *').length).toBeGreaterThanOrEqual(19)
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('答錯會顯示正解並扣命，三命用完才失敗', async () => {
    const wrapper = mount(Day30Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get(`[data-choice=${WRONGS[0]}]`).trigger('click')
    expect(wrapper.get('[data-test=reveal]').text()).toContain('--previous')
    expect(wrapper.get('[data-test=lives]').text()).toContain('2')
    await wrapper.get('[data-test=next]').trigger('click')

    await wrapper.get(`[data-choice=${WRONGS[1]}]`).trigger('click')
    await wrapper.get('[data-test=next]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)

    await wrapper.get(`[data-choice=${WRONGS[2]}]`).trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.get('[data-test=lives]').text()).toContain('3')
  })

  it('第一次時間到先延長，第二次才算一次失誤', async () => {
    const wrapper = mount(Day30Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await vi.advanceTimersByTimeAsync(20_100)
    expect(wrapper.find('[data-test=reveal]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(10_100)
    expect(wrapper.get('[data-test=reveal]').text()).toContain('時間到')
    expect(wrapper.get('[data-test=lives]').text()).toContain('2')
  })

  it('失敗後重來，舊局排程的合照角色不會跑進新局', async () => {
    const wrapper = mount(Day30Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await wrapper.get('[data-choice=previous]').trigger('click')
    await wrapper.get('[data-test=next]').trigger('click')
    for (const id of ['nodeport', 'wait']) {
      await wrapper.get(`[data-choice=${id}]`).trigger('click')
      await wrapper.get('[data-test=next]').trigger('click')
    }
    await wrapper.get('[data-choice=emptydir]').trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-retry]').trigger('click')
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.findAll('[data-test=photo] > *')).toHaveLength(0)
    expect(wrapper.get('[data-test=lives]').text()).toContain('3')
    expect(wrapper.find('[data-choice=previous]').exists()).toBe(true)
  })
})
