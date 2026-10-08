import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChoiceCards from '@/presentation/games/kit/ChoiceCards.vue'

const options = [
  { id: 'node', label: 'Node' },
  { id: 'pod', label: 'Pod' },
  { id: 'container', label: 'Container' },
]

describe('ChoiceCards', () => {
  it('選錯發出 false 並讓該選項不可再點，答對後全部鎖定', async () => {
    const wrapper = mount(ChoiceCards, { props: { options, answer: 'pod' } })
    const card = (id: string) => wrapper.get(`[data-choice="${id}"]`)

    await card('node').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['node', false]])
    expect(card('node').attributes('disabled')).toBeDefined()

    await card('pod').trigger('click')
    expect(wrapper.emitted('choose')?.[1]).toEqual(['pod', true])
    expect(card('container').attributes('disabled')).toBeDefined()
  })

  it('answer 為陣列時任一皆正確', async () => {
    const wrapper = mount(ChoiceCards, { props: { options, answer: ['node', 'container'] } })
    await wrapper.get('[data-choice="container"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['container', true]])
  })
})
