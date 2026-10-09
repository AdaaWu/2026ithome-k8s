import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Day07Game from '@/presentation/games/days/Day07Game.vue'

// 縮排鈕每點一次 +2 格，6 之後回到 0
async function indent(wrapper: VueWrapper, line: string, taps: number) {
  for (let i = 0; i < taps; i++) await wrapper.get(`[data-indent=${line}]`).trigger('click')
}

async function send(wrapper: VueWrapper) {
  await wrapper.get('[data-test=send]').trigger('click')
  return wrapper
    .findAll('[data-test=error] code')
    .map((line) => line.text())
    .join(' ')
}

async function fixValues(wrapper: VueWrapper) {
  await wrapper.get('[data-value=apiVersion]').trigger('click')
  await wrapper.get('[data-value=kind]').trigger('click')
}

describe('Day07Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('依序回報第一個錯誤，image 縮排錯依情況給不同訊息', async () => {
    const wrapper = mount(Day07Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')

    expect(await send(wrapper)).toContain('no matches for kind "pod" in version "apps/v1"')
    await wrapper.get('[data-value=kind]').trigger('click')
    expect(await send(wrapper)).toContain('no matches for kind "Pod" in version "apps/v1"')
    await wrapper.get('[data-value=apiVersion]').trigger('click')
    expect(await send(wrapper)).toContain('unknown field "name"')

    await indent(wrapper, 'name', 1)
    await indent(wrapper, 'containers', 1)
    await indent(wrapper, 'item', 1)
    // image 和 containers 同層：spec 底下多一個欄位
    await indent(wrapper, 'image', 1)
    expect(await send(wrapper)).toContain('unknown field "spec.image"')
    // image 縮過頭：YAML 本身壞掉
    await indent(wrapper, 'image', 2)
    expect(await send(wrapper)).toContain('error converting YAML to JSON')
    expect(wrapper.find('[data-test=shell-finish]').exists()).toBe(false)
  })

  it('修好 YAML、刪掉泡泡後過關，按收下這一課會 emit complete 一次', async () => {
    const wrapper = mount(Day07Game)
    await wrapper.get('[data-test=shell-start]').trigger('click')
    await fixValues(wrapper)
    await indent(wrapper, 'name', 1)
    await indent(wrapper, 'containers', 1)
    await indent(wrapper, 'item', 1)
    await indent(wrapper, 'image', 2)
    await wrapper.get('[data-test=send]').trigger('click')

    await wrapper.get('[data-test=pod]').trigger('click')
    await vi.advanceTimersByTimeAsync(5000)
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })
})
