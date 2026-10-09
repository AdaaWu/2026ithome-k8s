import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Score, SceneId } from '@/infrastructure/audio/score'
import { asContext, FakeAudioContext, FakeGain } from './fakeAudioContext'

const { playNote } = vi.hoisted(() => ({ playNote: vi.fn() }))
vi.mock('@/infrastructure/audio/voices', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/infrastructure/audio/voices')>()),
  playNote,
}))

const { createBgm } = await import('@/infrastructure/audio/bgm')

const MUSIC_KEY = 'k8s-cloud-island-music-muted'

// bpm 120：一拍 0.5 秒；曲子在解鎖後 0.05 秒開始
const steady = (id: SceneId, midi: number): Score => ({
  id,
  bpm: 120,
  lengthBeats: 2,
  tracks: [{ instrument: 'felt', notes: [0, 0.5, 1, 1.5].map((beat) => ({ beat, midi, dur: 0.5 })) }],
})

const SCORES = { title: steady('title', 60), map: steady('map', 72) }

let ctx: FakeAudioContext
let hidden = false

function setup(scores: Partial<Record<SceneId, Score>> = SCORES) {
  const fake = new FakeAudioContext()
  ctx = fake
  return createBgm({ getContext: () => asContext(fake), scores, random: () => 0.5 })
}

/** 以 25ms 為一步推進音訊時鐘，每步跑一次排程 */
function advance(seconds: number) {
  for (let i = 0; i < Math.round(seconds / 0.025); i++) {
    ctx.currentTime += 0.025
    vi.advanceTimersByTime(25)
  }
}

// 每個測試都會建立新引擎，只看這次的假 context 收到的音符
const calls = () => playNote.mock.calls.filter((c) => c[0] === asContext(ctx))
const times = () => calls().map((c) => c[3] as number)
const pitches = () => calls().map((c) => c[4] as number)

beforeEach(() => {
  vi.useFakeTimers()
  playNote.mockClear()
  localStorage.clear()
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isSceneId', () => {
  it('只認曲目裡的場景，不會被物件原型上的名稱騙過', async () => {
    const { isSceneId } = await import('@/infrastructure/audio/bgm')
    expect(isSceneId('codex')).toBe(true)
    expect(isSceneId('toString')).toBe(false)
    expect(isSceneId(undefined)).toBe(false)
  })
})

describe('bgm 開關設定', () => {
  it('預設音樂開啟', () => {
    expect(setup().isMusicMuted()).toBe(false)
  })

  it('讀取已存的關閉設定', () => {
    localStorage.setItem(MUSIC_KEY, '1')
    expect(setup().isMusicMuted()).toBe(true)
  })

  it('關閉與開啟會寫回瀏覽器', () => {
    const bgm = setup()
    bgm.setMusicMuted(true)
    expect(localStorage.getItem(MUSIC_KEY)).toBe('1')
    bgm.setMusicMuted(false)
    expect(localStorage.getItem(MUSIC_KEY)).toBe('0')
  })
})

describe('bgm 排程', () => {
  it('解鎖前只記住場景，不出聲', () => {
    const bgm = setup()
    bgm.playScene('title')
    advance(1)
    expect(bgm.currentScene()).toBeNull()
    expect(playNote).not.toHaveBeenCalled()
    bgm.unlock()
    expect(bgm.currentScene()).toBe('title')
  })

  it('任何頁面的第一次點擊就解鎖並播目前場景', () => {
    const bgm = setup()
    bgm.playScene('map')
    window.dispatchEvent(new Event('pointerdown'))
    expect(pitches()).toEqual([72])
  })

  it('音樂關閉時點擊只解鎖，不出聲', () => {
    localStorage.setItem(MUSIC_KEY, '1')
    const bgm = setup()
    bgm.playScene('map')
    window.dispatchEvent(new Event('keydown'))
    expect(calls()).toHaveLength(0)
    bgm.setMusicMuted(false)
    expect(calls()).toHaveLength(1)
  })

  it('只排出 lookahead 範圍內的音符', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    expect(times()).toEqual([0.05])
    advance(0.5)
    expect(times()).toEqual([0.05, 0.3, 0.55])
  })

  it('播完一輪從頭循環', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    advance(0.5)
    advance(0.5)
    expect(times().at(-1)).toBeCloseTo(1.05)
    expect(pitches()).toHaveLength(5)
    expect(new Set(pitches())).toEqual(new Set([60]))
  })

  it('swing 把反拍往後推', () => {
    const bgm = setup({ title: { ...steady('title', 60), swing: 0.2 } })
    bgm.playScene('title')
    bgm.unlock()
    advance(0.5)
    // 反拍 0.5 拍 → 0.5 + 0.2 × 0.5 = 0.6 拍
    expect(times()[1]).toBeCloseTo(0.05 + 0.6 * 0.5)
    expect(times()[2]).toBeCloseTo(0.55)
  })

  it('換曲時舊曲 1.2 秒淡出，新曲淡入', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    const oldBus = calls()[0][1] as FakeGain
    ctx.currentTime = 1
    bgm.playScene('map')
    expect(oldBus.gain.events).toContainEqual(['linear', 0, 2.2])
    const newBus = calls().at(-1)![1] as FakeGain
    expect(newBus).not.toBe(oldBus)
    expect(newBus.gain.events[0]).toEqual(['set', 0, 1])
    expect(pitches().at(-1)).toBe(72)
    expect(bgm.currentScene()).toBe('map')
  })

  it('舊曲依音訊時鐘淡出完才斷開', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    const oldBus = calls()[0][1] as FakeGain
    bgm.playScene('map')
    vi.advanceTimersByTime(5000)
    expect(oldBus.disconnected).toBe(false)
    const clock = ctx.oscillators.find((o) => 'offset' in o)!
    expect(clock.stopAt).toBeCloseTo(1.5)
    clock.onended!()
    expect(oldBus.disconnected).toBe(true)
  })

  it('同一場景重複呼叫不重播', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    advance(0.5)
    const count = calls().length
    bgm.playScene('title')
    expect(calls().length).toBe(count)
    const buses = new Set(calls().map((c) => c[1]))
    expect(buses.size).toBe(1)
  })

  it('關掉音樂時淡出並停止排程，打開後從頭播', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    const bus = calls()[0][1] as FakeGain
    bgm.setMusicMuted(true)
    expect(bus.gain.events).toContainEqual(['linear', 0, 1.2])
    expect(bgm.currentScene()).toBeNull()
    const count = calls().length
    advance(1)
    expect(calls().length).toBe(count)

    bgm.setMusicMuted(false)
    expect(times().at(-1)).toBeCloseTo(1.05)
  })

  it('分頁隱藏時暫停，回來接著播', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(ctx.suspend).toHaveBeenCalled()
    const count = calls().length
    vi.advanceTimersByTime(1000)
    expect(calls().length).toBe(count)

    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(ctx.resume).toHaveBeenCalled()
    advance(0.5)
    expect(times()).toEqual([0.05, 0.3, 0.55])
  })

  it('iOS 中斷後回到前景會恢復', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    ctx.state = 'interrupted'
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(ctx.suspend).not.toHaveBeenCalled()
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('解鎖時 context 處於中斷狀態也會恢復', () => {
    const bgm = setup()
    ctx.state = 'interrupted'
    bgm.unlock()
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('殘響輸入點就是音樂鏈那一顆 Convolver', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    expect(bgm.reverbInput()).toBe(ctx.convolvers[0])
    expect(ctx.convolvers).toHaveLength(1)
  })

  it('錯過太久的音符直接略過，不擠在同一刻', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    ctx.currentTime = 5
    vi.advanceTimersByTime(25)
    expect(times().slice(1).every((t) => t >= 5 - 0.05)).toBe(true)
  })

  it('音效播放時壓低音樂再回復', () => {
    const bgm = setup()
    bgm.playScene('title')
    bgm.unlock()
    ctx.currentTime = 2
    bgm.duckMusic()
    const duck = ctx.gains.find((g) => g.gain.events.some(([k, v]) => k === 'linear' && v === 0.5))
    expect(duck).toBeDefined()
    expect(duck!.gain.events.at(-1)).toEqual(['linear', 1, expect.closeTo(2.43)])
  })
})
