// 背景音樂播放引擎：讀樂譜資料，用 lookahead 排程即時合成
import { getAudioContext, needsResume } from './context'
import type { Instrument, SceneId, Score } from './score'
import { SCORES } from './scores'
import { createMusicChain, playNote, type MusicChain } from './voices'

const MUSIC_KEY = 'k8s-cloud-island-music-muted'

const TICK_MS = 25
const LOOKAHEAD = 0.15
const START_DELAY = 0.05
const FADE = 1.2
/** 落後超過這個秒數的音符直接略過，避免分頁卡頓後一次擠出來 */
const LATE_LIMIT = 0.05
const HUMAN_TIME = 0.01
const HUMAN_VEL = 0.1
const DUCK_LEVEL = 0.5
const DUCK_ATTACK = 0.03
const DUCK_RECOVER = 0.4
const GESTURES = ['pointerdown', 'pointerup', 'keydown', 'click'] as const

type Scores = Partial<Record<SceneId, Score>>

interface FlatNote {
  beat: number
  midi: number
  dur: number
  vel: number
  instrument: Instrument
}

interface Song {
  id: SceneId
  score: Score
  notes: FlatNote[]
  spb: number
  index: number
  loopStart: number
  bus: GainNode
}

/** 所有音軌攤平成依拍數排序的單一序列 */
function flatten(score: Score): FlatNote[] {
  if (score.lengthBeats <= 0 || score.bpm <= 0) return []
  return score.tracks
    .flatMap((track) =>
      track.notes
        .filter((n) => n.beat >= 0 && n.beat < score.lengthBeats)
        .map((n) => ({
          beat: n.beat,
          midi: n.midi,
          dur: n.dur,
          vel: (n.vel ?? 0.7) * (track.gain ?? 1),
          instrument: track.instrument,
        })),
    )
    .sort((a, b) => a.beat - b.beat)
}

/** 反拍（x.5 拍）往後推 swing × 半拍 */
export function swingBeat(beat: number, swing: number) {
  const frac = beat - Math.floor(beat)
  return Math.abs(frac - 0.5) < 1e-6 ? beat + swing * 0.5 : beat
}

function readMuted() {
  try {
    return localStorage.getItem(MUSIC_KEY) === '1'
  } catch {
    return false
  }
}

function writeMuted(value: boolean) {
  try {
    localStorage.setItem(MUSIC_KEY, value ? '1' : '0')
  } catch {
    // 無法寫入時只在本次生效
  }
}

interface BgmOptions {
  getContext: () => AudioContext | null
  scores: Scores
  random?: () => number
}

export function createBgm({ getContext, scores, random = Math.random }: BgmOptions) {
  let muted = readMuted()
  let unlocked = false
  let scene: SceneId | null = null
  let song: Song | null = null
  let chain: MusicChain | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  const jitter = (range: number) => (random() * 2 - 1) * range
  const pageHidden = () => typeof document !== 'undefined' && document.hidden

  function tick() {
    const ctx = getContext()
    if (!ctx || !song || !song.notes.length) return
    const { notes, spb, score, bus } = song
    const horizon = ctx.currentTime + LOOKAHEAD
    for (;;) {
      const note = notes[song.index]
      const at = song.loopStart + swingBeat(note.beat, score.swing ?? 0) * spb
      if (at >= horizon) break
      if (at >= ctx.currentTime - LATE_LIMIT) {
        const time = Math.max(ctx.currentTime, at + jitter(HUMAN_TIME))
        const vel = Math.min(1, Math.max(0.05, note.vel * (1 + jitter(HUMAN_VEL))))
        playNote(ctx, bus, note.instrument, time, note.midi, note.dur * spb, vel, random)
      }
      song.index++
      if (song.index >= notes.length) {
        song.index = 0
        song.loopStart += score.lengthBeats * spb
      }
    }
  }

  function startTimer() {
    if (timer || !song || pageHidden()) return
    timer = setInterval(tick, TICK_MS)
  }

  function stopTimer() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function fadeOut(ctx: AudioContext) {
    if (!song) return
    const { bus } = song
    song = null
    stopTimer()
    const now = ctx.currentTime
    bus.gain.cancelScheduledValues(now)
    bus.gain.setValueAtTime(bus.gain.value, now)
    bus.gain.linearRampToValueAtTime(0, now + FADE)
    // 用音訊時鐘計時，分頁暫停時淡出也跟著暫停
    const clock = ctx.createConstantSource()
    clock.offset.value = 0
    clock.connect(bus)
    clock.onended = () => {
      clock.disconnect()
      bus.disconnect()
    }
    clock.start(now)
    clock.stop(now + FADE + 0.3)
  }

  function start(id: SceneId) {
    const ctx = getContext()
    if (!ctx) return
    fadeOut(ctx)
    const score = scores[id]
    if (!score) return
    const { input } = ensureChain(ctx)
    const now = ctx.currentTime
    const bus = ctx.createGain()
    bus.gain.setValueAtTime(0, now)
    bus.gain.linearRampToValueAtTime(1, now + FADE)
    bus.connect(input)
    song = { id, score, notes: flatten(score), spb: 60 / score.bpm, index: 0, loopStart: now + START_DELAY, bus }
    tick()
    startTimer()
  }

  function ensureChain(ctx: AudioContext) {
    chain ??= createMusicChain(ctx, ctx.destination)
    return chain
  }

  function onVisibility() {
    const ctx = unlocked ? getContext() : null
    if (!ctx) return
    if (pageHidden()) {
      stopTimer()
      if (ctx.state === 'running') void ctx.suspend().catch(() => {})
      return
    }
    if (needsResume(ctx)) void ctx.resume().catch(() => {})
    startTimer()
  }

  /** 由使用者手勢呼叫，之後才會出聲 */
  function unlock() {
    const ctx = getContext()
    if (!ctx) return
    if (needsResume(ctx)) void ctx.resume().catch(() => {})
    unlocked = true
    if (!muted && scene && song?.id !== scene) start(scene)
  }

  // 任何頁面的第一次點擊或按鍵就解鎖，重新整理後停在其他頁也能播
  function onFirstGesture() {
    GESTURES.forEach((type) => window.removeEventListener(type, onFirstGesture, true))
    unlock()
  }

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  if (typeof window !== 'undefined') GESTURES.forEach((type) => window.addEventListener(type, onFirstGesture, true))

  return {
    /** 切到某場景的曲子；同一首正在播時不重播 */
    playScene(id: SceneId) {
      scene = id
      if (muted || !unlocked || song?.id === id) return
      start(id)
    },
    unlock,
    setMusicMuted(value: boolean) {
      muted = value
      writeMuted(value)
      const ctx = unlocked ? getContext() : null
      if (!ctx) return
      if (value) fadeOut(ctx)
      else if (scene && !song) start(scene)
    },
    isMusicMuted: () => muted,
    /** 正在播的曲子；沒解鎖或關掉音樂時是 null */
    currentScene: () => song?.id ?? null,
    /** 音效送殘響用，與音樂共用同一顆 */
    reverbInput() {
      const ctx = getContext()
      return ctx ? ensureChain(ctx).reverb : null
    },
    /** 音效出聲時短暫壓低音樂，讓回饋音清楚 */
    duckMusic() {
      const ctx = getContext()
      if (!ctx || !chain) return
      const g = chain.duck.gain
      const now = ctx.currentTime
      g.cancelScheduledValues(now)
      g.setValueAtTime(g.value, now)
      g.linearRampToValueAtTime(DUCK_LEVEL, now + DUCK_ATTACK)
      g.linearRampToValueAtTime(1, now + DUCK_ATTACK + DUCK_RECOVER)
    },
  }
}

export function isSceneId(name: unknown): name is SceneId {
  return typeof name === 'string' && Object.hasOwn(SCORES, name)
}

export const { playScene, unlock, setMusicMuted, isMusicMuted, currentScene, duckMusic, reverbInput } = createBgm({
  getContext: getAudioContext,
  scores: SCORES,
})
