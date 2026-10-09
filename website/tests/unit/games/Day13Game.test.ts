import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day13Game from '@/presentation/games/days/Day13Game.vue'

async function shout(wrapper: VueWrapper, words: string[]) {
  for (const w of words) await wrapper.get(`[data-word=${w}]`).trigger('click')
  await wrapper.get('[data-test=shout]').trigger('click')
}

describe('Day13Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('四回合照真實行為完成，按收下這一課只 emit complete 一次', async () => {
    const wrapper = mount(Day13Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await shout(wrapper, ['hello'])
    await vi.advanceTimersByTimeAsync(1600)
    await shout(wrapper, ['hello', 'dev', 'svc'])
    await vi.advanceTimersByTimeAsync(1600)

    await wrapper.get('[data-build=staging]').trigger('click')
    expect(wrapper.get('[data-test=terminal]').text()).toContain('namespace/staging created')
    await vi.advanceTimersByTimeAsync(1800)

    await wrapper.get('[data-choice=pass]').trigger('click')
    await vi.advanceTimersByTimeAsync(1200)
    await wrapper.get('[data-tree]').trigger('click')
    await vi.advanceTimersByTimeAsync(1800)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('跨區只喊 hello 會被同區的柱子接走，亂拼地址回 NXDOMAIN，都不會前進', async () => {
    const wrapper = mount(Day13Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await shout(wrapper, ['hello'])
    await vi.advanceTimersByTimeAsync(1600)

    await shout(wrapper, ['hello'])
    expect(wrapper.get('[role=status]').text()).toContain('同區優先')
    await vi.advanceTimersByTimeAsync(1600)
    expect(wrapper.get('[data-test=prompt]').text()).toContain('dev')

    await shout(wrapper, ['hello', 'svc'])
    expect(wrapper.get('[data-test=terminal]').text()).toContain('NXDOMAIN')
  })

  it('建在已有 hello 的圍籬會被拒絕', async () => {
    const wrapper = mount(Day13Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await shout(wrapper, ['hello'])
    await vi.advanceTimersByTimeAsync(1600)
    await shout(wrapper, ['hello', 'dev'])
    await vi.advanceTimersByTimeAsync(1600)

    await wrapper.get('[data-build=prod]').trigger('click')
    const out = wrapper.get('[data-test=terminal]').text()
    expect(out).toContain('$ kubectl create deploy hello')
    expect(out).toContain('already exists')
    await vi.advanceTimersByTimeAsync(1800)
    expect(wrapper.find('[data-build=staging]').exists()).toBe(true)
  })

  it('建錯圍籬 2 次就閃 staging 按鈕', async () => {
    const wrapper = mount(Day13Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await shout(wrapper, ['hello'])
    await vi.advanceTimersByTimeAsync(1600)
    await shout(wrapper, ['hello', 'dev'])
    await vi.advanceTimersByTimeAsync(1600)

    await wrapper.get('[data-build=prod]').trigger('click')
    expect(wrapper.get('[data-build=staging]').classes()).not.toContain('is-flash')
    await wrapper.get('[data-build=dev]').trigger('click')
    expect(wrapper.get('[data-build=staging]').classes()).toContain('is-flash')
  })
})
