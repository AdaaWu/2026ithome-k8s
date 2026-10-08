import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { useGame } from '@/application/useGame'

const feature = await loadFeature('features/codex.feature')

describeFeature(feature, ({ Scenario }) => {
  const game = useGame()

  Scenario('答對影子題，角色變彩色', ({ Given, When, And, Then }) => {
    Given('圖鑑裡有一隻影子角色 "bird"', () => {
      game.resetAll()
      expect(game.isUnlocked('bird')).toBe(false)
    })
    When('玩家點開影子 "bird"', () => game.seeCharacter('bird'))
    And('玩家選擇 "Container（容器）"', () => {
      game.answerCharacter('bird', 'Container（容器）')
    })
    Then('角色 "bird" 變成彩色', () => expect(game.isUnlocked('bird')).toBe(true))
    And('角色 "bird" 被記錄為看過', () => expect(game.isSeen('bird')).toBe(true))
  })

  Scenario('答錯影子題，角色維持影子', ({ Given, When, And, Then }) => {
    Given('圖鑑裡有一隻影子角色 "bird"', () => {
      game.resetAll()
    })
    When('玩家點開影子 "bird"', () => game.seeCharacter('bird'))
    And('玩家選擇 "Node（節點）"', () => {
      game.answerCharacter('bird', 'Node（節點）')
    })
    Then('角色 "bird" 仍然是影子', () => expect(game.isUnlocked('bird')).toBe(false))
    And('角色 "bird" 被記錄為看過', () => expect(game.isSeen('bird')).toBe(true))
  })
})
