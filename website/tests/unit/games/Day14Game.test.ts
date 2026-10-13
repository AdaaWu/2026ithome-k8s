import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day14Game from '@/presentation/games/days/Day14Game.vue'

async function start() {
  const wrapper = mount(Day14Game)
  await wrapper.get('[data-test=shell-start]').trigger('click')
  return wrapper
}

describe('Day14Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('selector 打錯時名單是空的，請求全部失敗', async () => {
    const wrapper = await start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.findAll('[data-test=endpoint]')).toHaveLength(0)
    expect(wrapper.get('[data-test=fail-count]').text()).toContain('3')
  })

  it('選錯 selector 名單仍空，不會過關', async () => {
    const wrapper = await start()
    await wrapper.get('[data-test=selector]').trigger('click')
    await wrapper.get('[data-choice=Hello]').trigger('click')
    await vi.advanceTimersByTimeAsync(20000)
    expect(wrapper.findAll('[data-test=endpoint]')).toHaveLength(0)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
  })

  it('修好 selector、做完滾動更新、累積成功請求後過關，complete 只發一次', async () => {
    const wrapper = await start()
    await wrapper.get('[data-test=selector]').trigger('click')
    await wrapper.get('[data-choice=hello]').trigger('click')
    // 啟動中的那顆不進名單
    expect(wrapper.findAll('[data-test=endpoint]')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.findAll('[data-test=endpoint]')).toHaveLength(3)

    const clusterIp = wrapper.get('[data-test=cluster-ip]').text()
    await vi.advanceTimersByTimeAsync(4000)
    await wrapper.get('[data-test=rollout]').trigger('click')
    await vi.advanceTimersByTimeAsync(15000)
    expect(wrapper.get('[data-test=cluster-ip]').text()).toBe(clusterIp)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('selector 選錯 2 次就閃正確選項', async () => {
    const wrapper = await start()
    await wrapper.get('[data-test=selector]').trigger('click')
    await wrapper.get('[data-choice=Hello]').trigger('click')
    expect(wrapper.get('.picker').attributes('data-flash')).toBeUndefined()
    await wrapper.get('[data-choice=name]').trigger('click')
    expect(wrapper.get('.picker').attributes('data-flash')).toBe('hello')
  })

  it('破掉的舊泡泡標示終止中', async () => {
    const wrapper = await start()
    await wrapper.get('[data-test=selector]').trigger('click')
    await wrapper.get('[data-choice=hello]').trigger('click')
    await vi.advanceTimersByTimeAsync(5100)
    expect(wrapper.findAll('.pod__state')[0]!.text()).toBe('終止中')
  })
})
