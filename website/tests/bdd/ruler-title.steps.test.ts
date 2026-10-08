import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import { useGame } from '@/application/useGame'
import { CHARACTERS } from '@/data/characters'
import { TOTAL_DAYS } from '@/domain/level'

const feature = await loadFeature('features/ruler-title.feature')

describeFeature(feature, ({ Scenario }) => {
  const game = useGame()

  const clearAllDays = () => {
    for (let d = 1; d <= TOTAL_DAYS; d++) game.clearDay(d)
  }
  const answerAll = (list = CHARACTERS) => list.forEach((c) => game.answerCharacter(c.id, c.answer))

  Scenario('30 關全破且圖鑑全收集', ({ Given, And, When, Then }) => {
    Given('玩家暱稱是 "小桑"', () => {
      game.resetAll()
      game.setNickname('小桑')
    })
    And('玩家已經通過全部 30 天關卡', clearAllDays)
    When('玩家答對圖鑑裡所有角色', () => answerAll())
    Then('玩家的稱號是 "K8s 雲之島統治大王"', () => {
      expect(game.title.value).toBe('K8s 雲之島統治大王')
      expect(game.isRuler.value).toBe(true)
    })
  })

  Scenario('關卡全破但圖鑑缺一隻', ({ Given, And, When, Then }) => {
    Given('玩家暱稱是 "小桑"', () => {
      game.resetAll()
      game.setNickname('小桑')
    })
    And('玩家已經通過全部 30 天關卡', clearAllDays)
    When('玩家答對圖鑑裡除了一隻以外的所有角色', () => answerAll(CHARACTERS.slice(1)))
    Then('玩家的稱號是 "雲之島守護者"', () => expect(game.title.value).toBe('雲之島守護者'))
  })

  Scenario('存檔重新整理後還在', ({ Given, And, When, Then }) => {
    Given('玩家暱稱是 "小桑"', () => {
      game.resetAll()
      game.setNickname('小桑')
    })
    And('玩家已經通過第 3 天', () => game.clearDay(3))
    When('玩家重新整理頁面', () => game.reloadFromStorage())
    Then('玩家暱稱仍是 "小桑"', () => expect(game.progress.value.nickname).toBe('小桑'))
    And('第 3 天顯示為已通過', () => expect(game.isDayCleared(3)).toBe(true))
  })
})
