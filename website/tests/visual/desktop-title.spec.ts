import { expect, test } from '@playwright/test'
import { settle, stabilize } from './stable'

const PLAYER = { nickname: '小桑', clearedDays: [1, 2, 3, 6, 9], unlockedCharacters: ['bird', 'bubble', 'tree', 'owl'] }

test.describe('起始畫面桌機視覺基準', () => {
  test('新玩家', async ({ page }) => {
    await stabilize(page, null)
    await page.goto('/')
    await settle(page)
    await expect(page).toHaveScreenshot('title-new.png', { fullPage: true })
  })

  test('回訪玩家', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/')
    await settle(page)
    await expect(page).toHaveScreenshot('title-returning.png', { fullPage: true })
  })
})
