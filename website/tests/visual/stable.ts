import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'

// Google Fonts 存成本機快取，之後的截圖不受網路影響
const FONT_CACHE = join(import.meta.dirname, '.font-cache')

async function serveFontsFromCache(page: Page) {
  mkdirSync(FONT_CACHE, { recursive: true })
  await page.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const key = createHash('sha1').update(route.request().url()).digest('hex')
    const body = join(FONT_CACHE, key)
    const meta = `${body}.json`
    if (existsSync(body) && existsSync(meta)) {
      const { status, headers } = JSON.parse(readFileSync(meta, 'utf8'))
      return route.fulfill({ status, headers, body: readFileSync(body) })
    }
    const res = await route.fetch()
    if (res.ok()) {
      writeFileSync(body, await res.body())
      writeFileSync(meta, JSON.stringify({ status: res.status(), headers: res.headers() }))
    }
    return route.fulfill({ response: res })
  })
}

const SAVE_KEY = 'k8s-cloud-island-save-v1'

export interface SaveSeed {
  nickname?: string
  clearedDays?: number[]
  unlockedCharacters?: string[]
}

/** 讓畫面每次都長一樣：固定亂數種子、凍結時鐘、預寫存檔 */
export async function stabilize(page: Page, seed: SaveSeed | null) {
  await serveFontsFromCache(page)
  // 時鐘暫停，只在 settle 裡手動往前推，倒數與即時模擬才不會在截圖間移動
  await page.clock.install({ time: new Date('2026-10-09T09:00:00+08:00') })
  await page.clock.pauseAt(new Date('2026-10-09T09:00:01+08:00'))
  await page.addInitScript((save) => {
    let s = 20261009
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    // 音樂排程用真實音訊時鐘並消耗亂數，會讓後面的隨機結果不固定，截圖時關掉音訊
    delete (window as { AudioContext?: unknown }).AudioContext
    localStorage.clear()
    if (save) localStorage.setItem('k8s-cloud-island-save-v1', save)
  }, seed ? JSON.stringify({ version: 1, nickname: '', clearedDays: [], seenCharacters: seed.unlockedCharacters ?? [], unlockedCharacters: [], ...seed }) : null)
}

/** 等字型與圖片載完，畫面才算穩定 */
export async function settle(page: Page) {
  // 字型來自 Google Fonts，網路不穩時會退回系統字型，這時截圖不可信，直接標示原因
  const fontsOk = await page.evaluate(async () => {
    const sample = '雲之島冒險 K8s'
    await Promise.all([document.fonts.load('16px Huninn', sample), document.fonts.load('16px "Noto Sans TC"', sample)])
    await document.fonts.ready
    return document.fonts.check('16px Huninn', sample) && document.fonts.check('16px "Noto Sans TC"', sample)
  })
  if (!fontsOk) throw new Error('Google Fonts 沒載到（網路問題），這次截圖不可信，請重跑')
  await page.waitForLoadState('networkidle')
  // 延遲載入的縮圖在畫面外不會自己載，整頁截圖前先全部載完
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => ((i as HTMLImageElement).loading = 'eager'))
    return Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r))))
  })
  await page.clock.runFor(1500)
  // CSS 進場動畫跑真實時間，不受凍結時鐘控制，等有限次的動畫播完再截圖
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  )
  // Vue 轉場靠 requestAnimationFrame 推進，時鐘暫停時可能還停在進場中途，推到全部結束再截圖
  for (let i = 0; i < 20; i++) {
    const moving = await page.evaluate(() => !!document.querySelector('[class*="-enter-"], [class*="-leave-"]'))
    if (!moving) break
    await page.clock.runFor(200)
  }
}

/** 遊戲中截圖：隱藏後加的「看簡報」按鈕，只比對遊戲本身 */
export const IN_GAME_SHOT = { stylePath: join(import.meta.dirname, 'hide-briefing-button.css') }

export { SAVE_KEY }
