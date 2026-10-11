import { expect, test } from '@playwright/test'
import { settle, stabilize } from './stable'

const PLAYER = { nickname: '小桑', clearedDays: [1, 2, 3, 6, 9], unlockedCharacters: ['bird', 'bubble', 'tree', 'owl'] }

test.describe('島嶼地圖：平板與桌機', () => {
  test('整頁', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/map')
    await settle(page)
    await expect(page).toHaveScreenshot('map-full.png', { fullPage: true })
  })

  test('捲到中段時玩家資訊欄仍固定', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/map')
    await settle(page)
    await page.getByTestId('day-19').scrollIntoViewIfNeeded()
    await settle(page)
    await expect(page).toHaveScreenshot('map-scrolled.png')
  })
})
