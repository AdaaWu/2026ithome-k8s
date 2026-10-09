import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day02Game from '@/presentation/games/days/Day02Game.vue'

const STEPS = ['kind-create', 'get-nodes', 'run', 'get-pods', 'port-forward']

const tapCmd = (wrapper: VueWrapper, id: string) => wrapper.get(`[data-cmd=${id}]`).trigger('click')

describe('Day02Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('島還沒蓋就下 kubectl 會被拒絕，指令卡不會鎖定', async () => {
    const wrapper = mount(Day02Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await tapCmd(wrapper, 'get-nodes')
    expect(wrapper.get('[data-test=terminal]').text()).toContain('connection to the server')
    expect(wrapper.get('[data-cmd=get-nodes]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
  })

  it('干擾卡只給提示不會前進', async () => {
    const wrapper = mount(Day02Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await tapCmd(wrapper, 'kubectl-create-cluster')
    expect(wrapper.get('[role=status]').text()).toContain('Kind')
    await tapCmd(wrapper, 'docker-run')
    expect(wrapper.get('[role=status]').text()).toContain('不歸島管')
    expect(wrapper.find('[data-test=stage-island]').exists()).toBe(false)
  })

  it('依序吹完 5 張正解後，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day02Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (const id of STEPS) {
      await tapCmd(wrapper, id)
      await vi.advanceTimersByTimeAsync(700)
    }
    expect(wrapper.get('[data-test=terminal]').text()).toContain('8080')
    await vi.advanceTimersByTimeAsync(2000)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('連錯 2 次會閃下一張正解卡', async () => {
    const wrapper = mount(Day02Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    await tapCmd(wrapper, 'docker-run')
    expect(wrapper.get('[data-cmd=kind-create]').classes()).not.toContain('is-flash')
    await tapCmd(wrapper, 'get-nodes')
    expect(wrapper.get('[data-cmd=kind-create]').classes()).toContain('is-flash')
  })

  it('最後一步完成後到過關前，點干擾卡不會跳錯誤', async () => {
    const wrapper = mount(Day02Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    for (const id of STEPS) await tapCmd(wrapper, id)

    await tapCmd(wrapper, 'docker-run')
    expect(wrapper.get('[data-test=terminal]').text()).toContain('8080')
    expect(wrapper.get('[role=status]').text()).not.toContain('不歸島管')
    await vi.advanceTimersByTimeAsync(1700)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(true)
  })
})
