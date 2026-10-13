import { expect, test } from '@playwright/test'

test.describe('玩家旅程', () => {
  test('輸入暱稱後先看序章再進入地圖，重新整理後存檔還在', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('輸入暱稱').fill('小桑')
    await page.getByTestId('start').click()
    await expect(page).toHaveURL(/#\/prologue/)
    await page.getByTestId('prologue-go').click()
    await expect(page).toHaveURL(/#\/map/)
    await expect(page.getByText('小桑')).toBeVisible()

    await page.reload()
    await expect(page.getByText('小桑')).toBeVisible()
  })

  test('沒有暱稱時直接打開地圖會被帶回起始畫面', async ({ page }) => {
    await page.goto('/#/map')
    await expect(page.getByTestId('start')).toBeVisible()
  })

  test('圖鑑：點影子、答對後變彩色', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('輸入暱稱').fill('小桑')
    await page.getByTestId('start').click()
    await page.getByTestId('prologue-go').click()
    await page.getByTestId('codex-link').click()

    await page.getByTestId('codex-bird').click()
    await page.getByRole('button', { name: /Container/ }).click()
    await expect(page.getByText('答對了！')).toBeVisible()
    await expect(page.getByTestId('codex-count')).toHaveText('1')
  })
})
