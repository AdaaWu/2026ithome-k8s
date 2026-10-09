import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day20Game from '@/presentation/games/days/Day20Game.vue'

const SAFE = ['rbac', 'etcd', 'kms']
const UNSAFE = ['base64', 'describe', 'git']

async function sort(wrapper: VueWrapper, card: string, bin: 'safe' | 'unsafe') {
  await wrapper.get(`[data-card=${card}]`).trigger('click')
  await wrapper.get(`[data-bin=${bin}]`).trigger('click')
}

async function decode(wrapper: VueWrapper) {
  await wrapper.get('[data-test=shell-start]').trigger('click')
  await wrapper.get('[data-test=decode]').trigger('click')
  await vi.advanceTimersByTimeAsync(3000)
  expect(wrapper.text()).toContain('p4ssw0rd')
  await wrapper.get('[data-test=next]').trigger('click')
}

describe('Day20Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('放錯會說明原因，錯超過 2 次失敗，再玩一次回到分類', async () => {
    const wrapper = mount(Day20Game)
    await decode(wrapper)
    await sort(wrapper, 'describe', 'safe')
    expect(wrapper.get('[role=status]').text()).toContain('螢幕')
    await sort(wrapper, 'base64', 'safe')
    await sort(wrapper, 'git', 'safe')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)

    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.findAll('[data-card]')).toHaveLength(6)
  })

  it('base64 解開後六張卡全部歸位，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day20Game)
    await decode(wrapper)
    for (const card of SAFE) await sort(wrapper, card, 'safe')
    for (const card of UNSAFE) await sort(wrapper, card, 'unsafe')
    await vi.advanceTimersByTimeAsync(2000)

    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('鎖頭畫面說明 etcd 預設不加密，不把 base64 說成 etcd 的儲存格式', async () => {
    const wrapper = mount(Day20Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    expect(wrapper.get('.lock__note').text()).toBe('etcd 預設不加密，存的是解開後的原值')
  })

  it('失敗後 retry，舊的搖晃回呼不會留在新局', async () => {
    const wrapper = mount(Day20Game)
    await decode(wrapper)
    await sort(wrapper, 'describe', 'safe')
    await sort(wrapper, 'base64', 'safe')
    await sort(wrapper, 'git', 'safe')
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.find('.cards .shake').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(false)
    expect(wrapper.get('.sort__tip').text()).toContain('錯 0 / 2')
    await sort(wrapper, 'rbac', 'safe')
    expect(wrapper.findAll('[data-card]')).toHaveLength(5)
  })
})
