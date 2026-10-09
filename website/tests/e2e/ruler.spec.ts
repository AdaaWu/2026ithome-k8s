import { expect, test } from '@playwright/test'
import { CHARACTERS } from '../../src/data/characters'

test('30 關全破後答對最後一隻圖鑑，就拿到統治大王證書', async ({ page }) => {
  const [last, ...rest] = CHARACTERS
  const save = {
    version: 1,
    nickname: '小桑',
    clearedDays: Array.from({ length: 30 }, (_, i) => i + 1),
    seenCharacters: rest.map((c) => c.id),
    unlockedCharacters: rest.map((c) => c.id),
  }
  await page.addInitScript((s) => localStorage.setItem('k8s-cloud-island-save-v1', s), JSON.stringify(save))

  await page.goto('/#/codex')
  await page.getByTestId(`codex-${last.id}`).click()
  await page.getByRole('button', { name: last.answer, exact: true }).click()

  await expect(page).toHaveURL(/#\/ruler/)
  await expect(page.getByTestId('certificate')).toContainText('小桑')
  await expect(page.getByTestId('certificate')).toContainText('K8s 雲之島統治大王')
})
