import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day16Game from '@/presentation/games/days/Day16Game.vue'

async function startAndInstall() {
  const wrapper = mount(Day16Game)
  await wrapper.get('[data-test=shell-start]').trigger('click')
  await wrapper.get('[data-test=gatekeeper]').trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  return wrapper
}

describe('Day16Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('沒有守門員時，規則寫好了訪客也不會動', async () => {
    const wrapper = mount(Day16Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.get('[data-test=visitor]').text()).toContain('timeout')
    expect(wrapper.get('[role=status]').text()).toContain('沒人動')
  })

  it('選到干擾卡，/api 會被送去 shop，不會過關', async () => {
    const wrapper = await startAndInstall()
    await wrapper.get('[data-rule=blog]').trigger('click')
    await wrapper.get('[data-rule=decoy]').trigger('click')
    await wrapper.get('[data-test=run]').trigger('click')
    await vi.advanceTimersByTimeAsync(10000)
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
    expect(wrapper.find('[data-test=run]').exists()).toBe(true)
  })

  it('裝守門員、選對 2 張規則，6 位訪客都正確就過關，complete 只發一次', async () => {
    const wrapper = await startAndInstall()
    await wrapper.get('[data-rule=blog]').trigger('click')
    await wrapper.get('[data-rule=api]').trigger('click')
    await wrapper.get('[data-test=run]').trigger('click')
    await vi.advanceTimersByTimeAsync(12000)
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('開門放行連點兩次只跑一輪訪客', async () => {
    const wrapper = await startAndInstall()
    await wrapper.get('[data-rule=blog]').trigger('click')
    await wrapper.get('[data-rule=api]').trigger('click')
    // 同一個 tick 內連點兩下，DOM 還沒換掉按鈕
    const run = wrapper.get('[data-test=run]').element as HTMLButtonElement
    run.click()
    run.click()
    await vi.advanceTimersByTimeAsync(1300)
    expect(wrapper.get('[data-test=visitor]').text()).toContain('blog.example.com')
  })

  it('沒裝守門員一直點看板 2 次就閃守門員', async () => {
    const wrapper = mount(Day16Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    const board = wrapper.findAll('.gate > button')[0]!
    await board.trigger('click')
    expect(wrapper.get('[data-test=gatekeeper]').classes()).not.toContain('is-flash')
    await board.trigger('click')
    expect(wrapper.get('[data-test=gatekeeper]').classes()).toContain('is-flash')
  })

  it('規則選錯 2 次就閃正確的兩張卡', async () => {
    const wrapper = await startAndInstall()
    await wrapper.get('[data-rule=api]').trigger('click')
    await wrapper.get('[data-rule=decoy]').trigger('click')
    await wrapper.get('[data-test=run]').trigger('click')
    expect(wrapper.get('[data-rule=api]').classes()).not.toContain('is-flash')
    await wrapper.get('[data-test=run]').trigger('click')
    expect(wrapper.get('[data-rule=api]').classes()).toContain('is-flash')
    expect(wrapper.get('[data-rule=blog]').classes()).toContain('is-flash')
    expect(wrapper.get('[data-rule=decoy]').classes()).not.toContain('is-flash')
  })
})
