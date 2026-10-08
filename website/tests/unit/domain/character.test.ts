import { describe, expect, it } from 'vitest'
import { isCorrectAnswer, type Character } from '@/domain/character'

const bird: Character = {
  id: 'bird',
  name: '小鳥',
  k8sName: 'Container',
  zhTerm: '容器',
  category: 'world',
  riddle: '三大核心之一，被包在泡泡裡面的是什麼？',
  description: '真正在跑你程式的東西',
  options: ['Node（節點）', 'Container（容器）', 'Service（服務）', 'Namespace（命名空間）'],
  answer: 'Container（容器）',
  debutDay: 3,
}

describe('isCorrectAnswer', () => {
  it('選到正確選項時回傳 true', () => {
    expect(isCorrectAnswer(bird, 'Container（容器）')).toBe(true)
  })

  it('選到錯誤選項時回傳 false', () => {
    expect(isCorrectAnswer(bird, 'Node（節點）')).toBe(false)
  })

  it('忽略大小寫與前後空白', () => {
    expect(isCorrectAnswer(bird, '  container（容器） ')).toBe(true)
  })
})
