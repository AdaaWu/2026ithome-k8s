import { expect, test, type Page } from '@playwright/test'
import { SAVE_KEY, settle, stabilize } from './stable'

const PLAYER = { nickname: '小桑', clearedDays: [1, 2, 3, 6, 9], unlockedCharacters: ['bird', 'bubble', 'tree', 'owl'] }
const SHOT_DAYS = [1, 3, 10, 16, 21, 29]
const pad = (d: number) => String(d).padStart(2, '0')

test.describe('桌機小遊戲舞台', () => {
  for (const day of SHOT_DAYS) {
    test(`Day ${day}：準備層與遊戲中`, async ({ page }) => {
      await stabilize(page, PLAYER)
      await page.goto(`/#/day/${day}`)
      await settle(page)
      await page.getByTestId('start-game').click()
      await settle(page)
      // 準備卡片的彈出動畫走真實時間，等它播完再截圖
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)))
      await expect(page).toHaveScreenshot(`games-day${pad(day)}-ready.png`)
      await page.getByTestId('shell-start').click()
      await settle(page)
      await expect(page).toHaveScreenshot(`games-day${pad(day)}-play.png`, { fullPage: true })
    })
  }
})

// 真實時間完整玩到過關，確認放大後每一下點擊都打在對的元素上
const PLAYS: Record<number, (page: Page) => Promise<void>> = {
  async 2(page) {
    await tap(page, '[data-cmd=get-nodes]')
    await tap(page, '[data-cmd=kubectl-create-cluster]')
    for (const id of ['kind-create', 'get-nodes', 'run', 'get-pods', 'port-forward']) {
      await tap(page, `[data-cmd=${id}]`)
      await page.waitForTimeout(500)
    }
  },
  async 7(page) {
    await tap(page, '[data-test=send]')
    await tap(page, '[data-value=apiVersion]')
    await tap(page, '[data-value=kind]')
    for (const id of ['name', 'containers', 'item']) await tap(page, `[data-indent=${id}]`)
    for (let i = 0; i < 6; i++) await tap(page, '[data-indent=image]')
    await tap(page, '[data-test=send]')
    await page.waitForTimeout(500)
    await tap(page, '[data-test=pod]')
  },
  async 29(page) {
    const lines = [
      ['whistle', 'lighthouse', 'memory-tree'],
      ['patrol-captain', 'steward', 'owl', 'tree-picker', 'lighthouse'],
      ['squirrel', 'bubble', 'bird', 'ready-flag'],
      ['gate-map', 'totem', 'road-keeper', 'bubble', 'bird'],
      ['bird', 'borrow-slip', 'warehouse'],
    ]
    await tap(page, '[data-role=tree-picker]')
    for (const line of lines) {
      for (const id of line) {
        await tap(page, `[data-role=${id}]`)
        await page.waitForTimeout(150)
      }
      await page.waitForTimeout(1400)
    }
    await tap(page, '[data-choice=no]')
    await tap(page, '[data-choice=yes]')
    await page.waitForTimeout(1200)
    await tap(page, '[data-choice=no]')
  },
}

/** 用滑鼠點元素中心；先確認那個座標上真的是目標元素，提示氣泡擋住時等它自己收起 */
async function tap(page: Page, selector: string) {
  const target = page.locator(selector).first()
  // 置中捲動，避免目標躲在黏頂的 TopBar 底下
  await target.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  let point = { x: 0, y: 0 }
  await expect
    .poll(
      async () => {
        const box = await target.boundingBox()
        if (!box) return false
        point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        return target.evaluate((el, { x, y }) => el.contains(document.elementFromPoint(x, y)), point)
      },
      { message: `${selector} 的中心點被別的元素擋住`, timeout: 5000 },
    )
    .toBe(true)
  await page.mouse.click(point.x, point.y)
  await page.waitForTimeout(250)
}

test.describe('桌機放大後完整過關', () => {
  for (const day of Object.keys(PLAYS).map(Number)) {
    test(`Day ${day}：玩到過關`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop-1280', '只在 1280 寬實玩')
      test.setTimeout(60_000)
      await page.addInitScript(
        ([key, save]) => {
          if (sessionStorage.getItem('seeded')) return
          localStorage.setItem(key, save)
          sessionStorage.setItem('seeded', '1')
        },
        [SAVE_KEY, JSON.stringify({ version: 1, nickname: 'QA', clearedDays: [], seenCharacters: [], unlockedCharacters: [] })],
      )
      await page.goto(`/#/day/${day}`)
      await page.getByTestId('start-game').click()
      await page.getByTestId('shell-start').click()

      // 1280×800 屬於矮螢幕，舞台放大 1.1 倍
      const width = await page.locator('.shell__stage').evaluate((el) => el.getBoundingClientRect().width)
      expect(Math.round(width)).toBe(Math.round(360 * 1.1))

      await PLAYS[day](page)
      await page.getByTestId('shell-finish').click({ timeout: 10_000 })
      await expect(page.getByTestId('takeaway')).toBeVisible()
      const cleared = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').clearedDays, SAVE_KEY)
      expect(cleared).toContain(day)
    })
  }
})
