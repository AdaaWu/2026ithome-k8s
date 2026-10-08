import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GameShell from '@/presentation/games/kit/GameShell.vue'

describe('GameShell', () => {
  it('intro 顯示開始按鈕，按下發出 start', async () => {
    const wrapper = mount(GameShell, { props: { hint: '點出那一層', status: 'intro' } })
    expect(wrapper.get('.shell__overlay').text()).toContain('點出那一層')
    await wrapper.get('[data-test=shell-start]').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('playing 顯示舞台、計時條與回合點', () => {
    const wrapper = mount(GameShell, {
      props: { hint: 'h', status: 'playing', timer: { remaining: 3, total: 6 }, progress: { current: 2, total: 8 } },
      slots: { default: '<p class="stage-content">舞台</p>' },
    })
    expect(wrapper.find('.stage-content').exists()).toBe(true)
    expect(wrapper.get('[data-test=shell-timer]').attributes('style')).toContain('50%')
    expect(wrapper.findAll('[data-test=shell-dot]')).toHaveLength(8)
    expect(wrapper.findAll('[data-test=shell-dot].is-done')).toHaveLength(2)
    expect(wrapper.find('[data-test=shell-start]').exists()).toBe(false)
  })

  it('won 顯示標題與 aha，按收下這一課發出 finish', async () => {
    const wrapper = mount(GameShell, { props: { hint: 'h', status: 'won', aha: '泡泡就是 Pod' } })
    expect(wrapper.text()).toContain('過關！')
    expect(wrapper.text()).toContain('泡泡就是 Pod')
    await wrapper.get('[data-test=shell-finish]').trigger('click')
    expect(wrapper.emitted('finish')).toHaveLength(1)
  })

  it('lost 顯示失敗說明，按再玩一次發出 retry', async () => {
    const wrapper = mount(GameShell, { props: { hint: 'h', status: 'lost', loseText: '從外到內' } })
    expect(wrapper.text()).toContain('從外到內')
    await wrapper.get('[data-test=shell-retry]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
