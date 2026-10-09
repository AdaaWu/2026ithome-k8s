import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day28Game from '@/presentation/games/days/Day28Game.vue'

async function assign(wrapper: VueWrapper, card: string, manager: string) {
  await wrapper.get(`[data-card=${card}]`).trigger('click')
  await wrapper.get(`[data-manager=${manager}]`).trigger('click')
}

describe('Day28Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('四張卡派對人並種新樹，按收下這一課只 emit complete 一次', async () => {
    const wrapper = mount(Day28Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await assign(wrapper, 'logs', 'tree-guard-captain')
    await assign(wrapper, 'migrate', 'job-ticket')
    await assign(wrapper, 'backup', 'cron-clock')
    await assign(wrapper, 'web', 'steward')
    await wrapper.get('[data-test=work]').trigger('click')
    await vi.advanceTimersByTimeAsync(8000)

    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
    await wrapper.get('[data-test=new-tree]').trigger('click')
    await vi.advanceTimersByTimeAsync(3000)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('沒定義的組合一律失敗，卡片退回卡區', async () => {
    const wrapper = mount(Day28Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await assign(wrapper, 'backup', 'job-ticket')
    await assign(wrapper, 'logs', 'cron-clock')
    await assign(wrapper, 'migrate', 'steward')
    await assign(wrapper, 'web', 'tree-guard-captain')
    await wrapper.get('[data-test=work]').trigger('click')
    await vi.advanceTimersByTimeAsync(8000)

    const log = wrapper.get('[data-test=worklog]').text()
    expect(log).toContain('凌晨 3 點不會再跑')
    expect(log).toContain('不負責這種工作')
    expect(log).toContain('CrashLoopBackOff')
    expect(wrapper.find('[data-test=new-tree]').exists()).toBe(false)
    expect(wrapper.get('[data-manager=job-ticket]').text()).not.toContain('備份')
  })
})
