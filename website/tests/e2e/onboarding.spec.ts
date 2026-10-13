import { expect, test, type Page } from '@playwright/test'
import { CHARACTERS } from '../../src/data/characters'

const SAVE_KEY = 'k8s-cloud-island-save-v1'

async function seedPlayer(page: Page, clearedDays: number[] = []) {
  await page.addInitScript(
    ({ key, days }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify({ version: 1, nickname: '小桑', clearedDays: days, seenCharacters: [], unlockedCharacters: [] }))
      }
    },
    { key: SAVE_KEY, days: clearedDays },
  )
}

/** 直接觸發小遊戲的 complete 事件，測過關頁時不必真的玩完 */
async function finishGame(page: Page) {
  await page.evaluate(() => {
    type VNode = { props?: Record<string, unknown> | null; component?: { subTree: VNode } | null; children?: unknown }
    const root = (document.querySelector('#app') as unknown as { _vnode: VNode })._vnode
    const walk = (v: VNode | null | undefined): boolean => {
      if (!v) return false
      const done = v.props?.onComplete
      if (typeof done === 'function') {
        done()
        return true
      }
      if (v.component && walk(v.component.subTree)) return true
      return Array.isArray(v.children) && v.children.some((c) => walk(c as VNode))
    }
    walk(root)
  })
}

test.describe('新手引導', () => {
  test('回訪玩家按繼續冒險直接進地圖，不經過序章', async ({ page }) => {
    await seedPlayer(page)
    await page.goto('/')
    await page.getByTestId('continue').click()
    await expect(page).toHaveURL(/#\/map/)
  })

  test('地圖有常駐序章入口與每幕本章目標', async ({ page }) => {
    await seedPlayer(page)
    await page.goto('/#/map')
    await expect(page.locator('.act__goal')).toHaveCount(6)
    await page.getByTestId('prologue-link').click()
    await expect(page).toHaveURL(/#\/prologue/)
    await expect(page.getByText('三條世界規則')).toBeVisible()
  })

  test('關卡開場先看簡報，章節開場只在每幕第一關', async ({ page }) => {
    await seedPlayer(page)
    await page.goto('/#/day/6')
    await expect(page.getByTestId('briefing')).toContainText('泡泡室友配對')
    await expect(page.getByTestId('chapter-opening')).toContainText('本章目標')
    // 會遇到依登場日排序
    await expect(page.getByTestId('chapter-opening')).toContainText('共享食物桶、食盆、彩色貼紙、放大鏡、貓頭鷹、部署管家')
    // 登場角色直接顯示名稱，與章節開場一致
    await expect(page.locator('.intro__cast')).toContainText('共享食物桶')
    await page.goto('/#/day/7')
    await expect(page.getByTestId('briefing')).toContainText('YAML 縮排師')
    await expect(page.getByTestId('chapter-opening')).toHaveCount(0)
  })

  test('遊戲中開關簡報彈窗，計時暫停且遊戲進度不重來', async ({ page }) => {
    await seedPlayer(page)
    await page.goto('/#/day/1')
    await page.getByTestId('start-game').click()
    await page.getByTestId('shell-start').click()
    await expect(page.getByTestId('shell-start')).toHaveCount(0)

    await page.getByTestId('briefing-open').click()
    const dialog = page.getByTestId('briefing-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('過關條件')
    await expect(dialog).toContainText('遊戲暫停')

    // 彈窗開著時計時條不前進
    const timer = page.getByTestId('shell-timer')
    const widthWhenOpened = await timer.evaluate((el) => (el as HTMLElement).style.width)
    await page.waitForTimeout(1500)
    expect(await timer.evaluate((el) => (el as HTMLElement).style.width)).toBe(widthWhenOpened)

    await page.getByTestId('briefing-close').click()
    await expect(dialog).toHaveCount(0)
    // 遊戲元件沒有重新掛載，就不會再出現「準備好了嗎？」
    await expect(page.getByTestId('shell-start')).toHaveCount(0)
    await expect(page.locator('.shell__stage')).toBeVisible()
    // 關閉後計時繼續
    await expect.poll(() => timer.evaluate((el) => (el as HTMLElement).style.width)).not.toBe(widthWhenOpened)
  })

  test('簡報彈窗按 Esc 關閉', async ({ page }) => {
    await seedPlayer(page)
    await page.goto('/#/day/2')
    await page.getByTestId('start-game').click()
    await page.getByTestId('shell-start').click()
    await page.getByTestId('briefing-open').click()
    await expect(page.getByTestId('briefing-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('briefing-dialog')).toHaveCount(0)
  })

  test('30 關全破但圖鑑未完成，過關頁提示還差幾位角色', async ({ page }) => {
    await seedPlayer(page, Array.from({ length: 30 }, (_, i) => i + 1))
    await page.goto('/#/day/30')
    await page.getByTestId('start-game').click()
    await finishGame(page)
    await expect(page.getByTestId('codex-tip')).toContainText(`還差 ${CHARACTERS.length} 位角色`)
  })

  test('圖鑑彈窗按 Esc 關閉', async ({ page }) => {
    await seedPlayer(page)
    await page.goto('/#/codex')
    await page.getByTestId('codex-squirrel').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('桌機 1280×800 開場', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 })

  test('30 關的開始任務都在第一屏內', async ({ page }) => {
    await seedPlayer(page)
    for (let day = 1; day <= 30; day++) {
      await page.goto(`/#/day/${day}`)
      await expect(page.getByTestId('start-game'), `Day ${day}`).toBeInViewport({ ratio: 1 })
    }
  })
})
