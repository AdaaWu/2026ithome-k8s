import { defineConfig, devices } from '@playwright/test'

// 多個 agent 平行跑測試時，各自用不同 port 與輸出資料夾，避免互相覆蓋
const port = Number(process.env.PW_PORT ?? 4173)
const outDir = port === 4173 ? 'dist' : `.pw-dist-${port}`

const shared = {
  baseURL: `http://localhost:${port}`,
  browserName: 'chromium' as const,
  channel: 'chrome',
  testIdAttribute: 'data-test',
}

export default defineConfig({
  // 整頁截圖要等縮圖與字型全部載完，給足時間
  timeout: 60_000,
  // 容許文字抗鋸齒的零星像素，版面位移會遠超過這個量
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixels: 100 } },
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  projects: [
    { name: 'e2e', testDir: './tests/e2e', use: { ...devices['iPhone 13'], ...shared } },
    // 手機版視覺基準：RWD 只能往上加，這兩組截圖必須一個像素都不變
    { name: 'mobile-360', testDir: './tests/visual', testMatch: /mobile\.spec\.ts/, use: { ...shared, viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'mobile-390', testDir: './tests/visual', testMatch: /mobile\.spec\.ts/, use: { ...shared, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'tablet-768', testDir: './tests/visual', testMatch: /desktop-.*\.spec\.ts/, use: { ...shared, viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 } },
    { name: 'desktop-1280', testDir: './tests/visual', testMatch: /desktop-.*\.spec\.ts/, use: { ...shared, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
    { name: 'desktop-1920', testDir: './tests/visual', testMatch: /desktop-.*\.spec\.ts/, use: { ...shared, viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: `bunx vite build --outDir ${outDir} --emptyOutDir && bunx vite preview --outDir ${outDir} --port ${port} --strictPort`,
    port,
    // 自訂 port 每次重新 build，才不會測到舊的程式
    reuseExistingServer: port === 4173,
    timeout: 120_000,
  },
})
