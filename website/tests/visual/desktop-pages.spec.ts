import { expect, test, type Page } from '@playwright/test'
import { CHARACTERS } from '../../src/data/characters'
import { settle, stabilize } from './stable'

const ALL_DAYS = Array.from({ length: 30 }, (_, i) => i + 1)
const PLAYER = { nickname: '小桑', clearedDays: [1, 2, 3, 6, 9], unlockedCharacters: ['bird', 'bubble', 'tree', 'owl'] }

/** 直接觸發小遊戲的 complete 事件，截過關頁時不必真的玩完 */
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

test.describe('桌機版：圖鑑、關卡頁、證書頁', () => {
  // 多位 agent 同時跑測試時機器較忙，關卡頁要截兩張圖，放寬逾時
  test.describe.configure({ timeout: 90_000 })

  test('角色圖鑑、影子題對話框、答對揭曉', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/codex')
    await settle(page)
    await expect(page).toHaveScreenshot('pages-codex.png', { fullPage: true })

    await page.getByTestId('codex-squirrel').click()
    await settle(page)
    await expect(page).toHaveScreenshot('pages-codex-dialog.png')

    await page.getByTestId('option-kubelet').click()
    await settle(page)
    await expect(page).toHaveScreenshot('pages-codex-reveal.png')
  })

  for (const day of [1, 15, 30]) {
    test(`Day ${day}：開場與遊戲中外框`, async ({ page }) => {
      await stabilize(page, PLAYER)
      await page.goto(`/#/day/${day}`)
      await settle(page)
      const dd = String(day).padStart(2, '0')
      await expect(page).toHaveScreenshot(`pages-day${dd}-intro.png`, { fullPage: true })
      await page.getByTestId('start-game').click()
      await settle(page)
      await page.getByRole('button', { name: /開始/ }).last().click()
      await settle(page)
      await expect(page).toHaveScreenshot(`pages-day${dd}-play.png`, { fullPage: true })
    })
  }

  test('過關頁', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/day/4')
    await settle(page)
    await page.getByTestId('start-game').click()
    await settle(page)
    await finishGame(page)
    await settle(page)
    await page.clock.runFor(5000)
    await expect(page.getByTestId('takeaway')).toBeVisible()
    await expect(page).toHaveScreenshot('pages-day-clear.png', { fullPage: true })
  })

  test('找不到的關卡', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/day/99')
    await settle(page)
    await expect(page).toHaveScreenshot('pages-day-missing.png', { fullPage: true })
  })

  test('證書頁：尚未登基與統治大王', async ({ page }) => {
    await stabilize(page, PLAYER)
    await page.goto('/#/ruler')
    await settle(page)
    await expect(page).toHaveScreenshot('pages-ruler-locked.png', { fullPage: true })

    await stabilize(page, { nickname: '小桑', clearedDays: ALL_DAYS, unlockedCharacters: CHARACTERS.map((c) => c.id) })
    await page.goto('/#/ruler')
    await page.reload()
    await settle(page)
    await page.clock.runFor(5000)
    await expect(page).toHaveScreenshot('pages-ruler-certificate.png', { fullPage: true })
  })
})
