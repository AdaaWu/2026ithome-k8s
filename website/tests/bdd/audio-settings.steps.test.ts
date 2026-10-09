import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber'
import { flushPromises, mount } from '@vue/test-utils'
import { expect, vi } from 'vitest'
import { FakeAudioContext } from '../unit/infrastructure/audio/fakeAudioContext'

const feature = await loadFeature('features/audio-settings.feature')

/** 重新載入模組，等同重新整理頁面後從瀏覽器讀回設定 */
async function openGame() {
  vi.resetModules()
  return (await import('@/application/useAudioSettings')).useAudioSettings()
}

describeFeature(feature, ({ Scenario, AfterEachScenario }) => {
  // 斷言失敗時也要還原，避免假 AudioContext 漏到其他測試
  AfterEachScenario(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  let settings: Awaited<ReturnType<typeof openGame>>

  Scenario('關掉音樂但保留音效', ({ Given, When, Then, And }) => {
    Given('玩家第一次打開遊戲', async () => {
      localStorage.clear()
      settings = await openGame()
    })
    When('玩家關掉音樂', () => settings.toggleMusic())
    Then('音樂是關閉的', () => expect(settings.musicOn.value).toBe(false))
    And('音效是開啟的', () => expect(settings.sfxOn.value).toBe(true))
  })

  Scenario('開關設定重新整理後還在', ({ Given, When, Then, And }) => {
    Given('玩家關掉音效', async () => {
      localStorage.clear()
      settings = await openGame()
      settings.toggleSfx()
    })
    When('玩家重新整理頁面', async () => {
      settings = await openGame()
    })
    Then('音效是關閉的', () => expect(settings.sfxOn.value).toBe(false))
    And('音樂是開啟的', () => expect(settings.musicOn.value).toBe(true))
  })

  Scenario('換頁時切換曲子', ({ Given, When, Then }) => {
    let router: typeof import('@/router').default

    Given('玩家在起始畫面按下登島出發', async () => {
      localStorage.clear()
      vi.resetModules()
      vi.stubGlobal('AudioContext', FakeAudioContext)
      router = (await import('@/router')).default
      const TitleView = (await import('@/presentation/views/TitleView.vue')).default
      await router.push('/')
      // 掛到 document 上，點擊才會冒泡到 window 的解鎖監聽
      const wrapper = mount(TitleView, { global: { plugins: [router] }, attachTo: document.body })
      await wrapper.get('#nickname').setValue('小桑')
      await wrapper.get('[data-test=start]').trigger('click')
      await flushPromises()
    })
    When('玩家進入角色圖鑑', async () => {
      await router.push('/codex')
    })
    Then('正在播放的曲子是 {string}', async (_ctx, scene: string) => {
      // currentScene 只回報真的在排程的曲子，沒解鎖或關掉音樂時是 null
      const bgm = await import('@/infrastructure/audio/bgm')
      expect(bgm.currentScene()).toBe(scene)
    })
  })
})
