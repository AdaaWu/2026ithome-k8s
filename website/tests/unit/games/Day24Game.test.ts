import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Day24Game from '@/presentation/games/days/Day24Game.vue'

const RIGHT: Record<string, string> = {
  回應變慢: 'flag',
  資料庫連不上: 'flag',
  死結: 'bell',
  開機中: 'wait',
}
const actionFor = (symptom: string, map: Record<string, string>) =>
  Object.entries(map).find(([k]) => symptom.includes(k))?.[1] ?? 'wait'

async function start() {
  const wrapper = mount(Day24Game)
  await wrapper.get('[data-test=shell-start]').trigger('click')
  await vi.advanceTimersByTimeAsync(1200)
  return wrapper
}

describe('Day24Game', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('開局 3 秒內就有一顆泡泡發病', async () => {
    const wrapper = await start()
    expect(wrapper.find('[data-test=symptom]').exists()).toBe(true)
  })

  it('一直搞反鈴與旗，失誤 3 次就失敗', async () => {
    const wrapper = await start()
    const WRONG = { 回應變慢: 'bell', 資料庫連不上: 'bell', 死結: 'flag', 開機中: 'bell' }
    for (let i = 0; i < 6 && !wrapper.find('[data-test=shell-retry]').exists(); i++) {
      const symptom = wrapper.find('[data-test=symptom]')
      if (symptom.exists()) await wrapper.get(`[data-action=${actionFor(symptom.text(), WRONG)}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(6000)
    }
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)
  })

  it('每個症狀都照正解處理，處理 8 個後過關，complete 只發一次', async () => {
    const wrapper = await start()
    for (let i = 0; i < 12 && !wrapper.find('[data-test=shell-finish]').exists(); i++) {
      const symptom = wrapper.find('[data-test=symptom]')
      if (symptom.exists()) await wrapper.get(`[data-action=${actionFor(symptom.text(), RIGHT)}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(4000)
    }
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('連錯 2 次閃正解；失敗後重來，舊局的延遲回呼不影響新局', async () => {
    const wrapper = await start()
    const WRONG = { 回應變慢: 'bell', 資料庫連不上: 'bell', 死結: 'flag', 開機中: 'bell' }
    for (let i = 0; i < 2; i++) {
      await wrapper.get(`[data-action=${actionFor(wrapper.get('[data-test=symptom]').text(), WRONG)}]`).trigger('click')
      await vi.advanceTimersByTimeAsync(1600)
    }
    const symptom = wrapper.get('[data-test=symptom]').text()
    expect(wrapper.get(`[data-action=${actionFor(symptom, RIGHT)}]`).classes()).toContain('is-flash')

    await wrapper.get(`[data-action=${actionFor(symptom, WRONG)}]`).trigger('click')
    expect(wrapper.find('[data-test=shell-retry]').exists()).toBe(true)
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.find('.is-flash').exists()).toBe(false)
    expect(wrapper.find('[data-test=symptom]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(900)
    expect(wrapper.find('[data-test=symptom]').exists()).toBe(false)
    expect(wrapper.text()).toContain('0 / 3')
    await vi.advanceTimersByTimeAsync(300)
    expect(wrapper.findAll('[data-test=symptom]')).toHaveLength(1)
  })
})
