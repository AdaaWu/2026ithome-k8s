import { expect, test, type Page } from '@playwright/test'
import { CHARACTERS } from '../../src/data/characters'
import { IN_GAME_SHOT, settle, stabilize } from './stable'

const ALL_DAYS = Array.from({ length: 30 }, (_, i) => i + 1)
const PLAYER = { nickname: '小桑', clearedDays: [1, 2, 3, 6, 9], unlockedCharacters: ['bird', 'bubble', 'tree', 'owl'] }

/** 「看簡報」按鈕壓到的標題列文字 */
function briefingButtonOverlaps(page: Page) {
  return page.evaluate(() => {
    const button = document.querySelector('[data-test="briefing-open"]')!.getBoundingClientRect()
    const hits: string[] = []
    for (const el of document.querySelectorAll('.play__head h2, .play__head p')) {
      const range = document.createRange()
      range.selectNodeContents(el)
      for (const r of range.getClientRects()) {
        if (r.left < button.right && r.right > button.left && r.top < button.bottom && r.bottom > button.top) hits.push(el.textContent ?? '')
      }
    }
    return hits
  })
}

test.describe('手機版視覺基準', () => {
  test('起始畫面：新玩家', async ({ page }) => {
    await stabilize(page, null)
    await page.goto('/')
    await settle(page)
    await expect(page).toHaveScreenshot('title-new.png', { fullPage: true })
  })

  test('起始畫面：回訪玩家', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/')
    await settle(page)
    await expect(page).toHaveScreenshot('title-returning.png', { fullPage: true })
  })

  test('島嶼地圖', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/map')
    await settle(page)
    await expect(page).toHaveScreenshot('map.png', { fullPage: true })
  })

  test('角色圖鑑與影子題', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/codex')
    await settle(page)
    await expect(page).toHaveScreenshot('codex.png', { fullPage: true })
    await page.getByTestId('codex-squirrel').click()
    await settle(page)
    await expect(page).toHaveScreenshot('codex-sheet.png')
  })

  test('證書頁：尚未登基與統治大王', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/ruler')
    await settle(page)
    await expect(page).toHaveScreenshot('ruler-locked.png', { fullPage: true })

    const ids = CHARACTERS.map((c) => c.id)
    await stabilize(page, { nickname: '小桑', clearedDays: ALL_DAYS, unlockedCharacters: ids })
    await page.goto('/#/ruler')
    await page.reload()
    await settle(page)
    await expect(page).toHaveScreenshot('ruler-certificate.png', { fullPage: true })
  })

  test('找不到的關卡', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/day/99')
    await settle(page)
    await expect(page).toHaveScreenshot('day-missing.png', { fullPage: true })
  })

  for (const day of ALL_DAYS) {
    test(`Day ${day}：開場與遊戲中`, async ({ page }) => {
      await stabilize(page, PLAYER)
      await page.goto(`/#/day/${day}`)
      await settle(page)
      await expect(page).toHaveScreenshot(`day${String(day).padStart(2, '0')}-intro.png`, { fullPage: true })
      await page.getByTestId('start-game').click()
      await settle(page)
      // GameShell 的「準備好了嗎？」覆蓋層
      await expect(page).toHaveScreenshot(`day${String(day).padStart(2, '0')}-ready.png`, IN_GAME_SHOT)
      await page.getByRole('button', { name: /開始/ }).last().click()
      await settle(page)
      await expect(page).toHaveScreenshot(`day${String(day).padStart(2, '0')}-play.png`, { ...IN_GAME_SHOT, fullPage: true })
      await expect(page.getByTestId('briefing-open')).toBeVisible()
      expect(await briefingButtonOverlaps(page)).toEqual([])
    })
  }

  test('遊戲中標題列：看簡報按鈕', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/day/24')
    await page.getByTestId('start-game').click()
    await settle(page)
    await expect(page.locator('.play__head')).toHaveScreenshot('play-head-briefing.png')
  })
})
