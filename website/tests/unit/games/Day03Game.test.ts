import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day03Game from '@/presentation/games/days/Day03Game.vue'

// 題目 → 正確層，依 specs/03 與 05 的 Day 3 題庫
const ANSWER: Record<string, string> = {
  'kubectl cluster-info': 'island',
  'kubectl get nodes': 'tree',
  'kubectl get pods -o wide': 'bubble',
  '列出泡泡裡每隻小鳥的名字': 'bird',
  'K8s 排程的最小單位': 'bubble',
  '可以是實體機，也可以是虛擬機': 'tree',
  '副本數在數的是誰': 'bubble',
  '壽命最長的一層': 'island',
}

describe('Day03Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('答錯會提示並可重答，不會失敗', async () => {
    const wrapper = mount(Day03Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    const right = ANSWER[wrapper.get('[data-test=question]').text()]
    const wrong = right === 'bird' ? 'island' : 'bird'

    await wrapper.get(`[data-layer=${wrong}]`).trigger('click')
    expect(wrapper.get('[role=status]').text()).not.toBe('')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.get(`[data-layer=${right}]`).attributes('disabled')).toBeUndefined()
  })

  it('答對全部回合並完成彩蛋後，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day03Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    for (let i = 0; i < Object.keys(ANSWER).length; i++) {
      const layer = ANSWER[wrapper.get('[data-test=question]').text()]
      await wrapper.get(`[data-layer=${layer}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1000)
    }

    await wrapper.get('[data-pod]').trigger('click')
    await vi.advanceTimersByTimeAsync(3000)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})
