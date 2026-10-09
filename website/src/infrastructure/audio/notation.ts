// 作曲用的小工具：把音名、和弦名展開成 NoteEvent，讓 scores.ts 好讀好改
import type { NoteEvent } from './score'

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

const CHORD_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  maj7: [0, 4, 7, 11],
  'maj7#11': [0, 4, 7, 11, 18],
  add9: [0, 4, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
}

const round2 = (n: number) => Math.round(n * 100) / 100
const clampVel = (v: number) => round2(Math.min(1, Math.max(0.05, v)))

/** 依序號給一點固定的力度起伏，同一份資料每次產出都一樣 */
const jitter = (i: number) => (((i * 7 + 3) % 5) - 2) * 0.012

function parsePitchClass(name: string): number {
  const m = /^([A-G])([b#]?)$/.exec(name)
  if (!m) throw new Error(`看不懂的音名：${name}`)
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (PITCH_CLASS[m[1]!]! + accidental + 12) % 12
}

/** 'C4' → 60，支援 # 與 b */
export function noteToMidi(name: string): number {
  const m = /^([A-G][b#]?)(-?\d)$/.exec(name)
  if (!m) throw new Error(`看不懂的音名：${name}`)
  const letter = m[1]!
  const octave = Number(m[2])
  const accidental = letter.endsWith('#') ? 1 : letter.endsWith('b') ? -1 : 0
  return (octave + 1) * 12 + PITCH_CLASS[letter[0]!]! + accidental
}

interface MelodyOptions {
  start?: number
  vel?: number
  beatsPerBar?: number
}

/**
 * 用文字寫旋律：`A5:2 C6:1 r:1 | G5:4`
 * - `音名:拍數`，`r:拍數` 是休止，`@0.5` 指定力度
 * - `|` 是小節線，位置不在小節邊界就拋錯
 * - 自動力度：強拍略重、反拍略輕，句尾（接一拍以上休止或結尾）收弱
 */
export function melody(src: string, opts: MelodyOptions = {}): NoteEvent[] {
  const { start = 0, vel = 0.6, beatsPerBar = 4 } = opts
  const tokens = src.trim().split(/\s+/).filter(Boolean)
  const notes: NoteEvent[] = []
  let pos = start

  tokens.forEach((token, i) => {
    if (token === '|') {
      if ((pos - start) % beatsPerBar !== 0) throw new Error(`小節線位置不對：第 ${pos} 拍`)
      return
    }
    const m = /^([^:]+):([\d.]+)(?:@([\d.]+))?$/.exec(token)
    if (!m) throw new Error(`看不懂的旋律記號：${token}`)
    const dur = Number(m[2])
    if (m[1] !== 'r') {
      const next = tokens.slice(i + 1).find((t) => t !== '|')
      const nextRest = next ? /^r:([\d.]+)$/.exec(next) : null
      const phraseEnd = !next || (nextRest !== null && Number(nextRest[1]) >= 1)
      let v = vel + jitter(notes.length)
      if ((pos - start) % beatsPerBar === 0) v += 0.04
      else if (pos % 1 !== 0) v -= 0.04
      if (phraseEnd) v *= 0.8
      notes.push({ beat: pos, midi: noteToMidi(m[1]!), dur, vel: m[3] ? Number(m[3]) : clampVel(v) })
    }
    pos += dur
  })
  return notes
}

/** 'Fmaj7 Bbadd9 | Dm7' → ['Fmaj7', 'Bbadd9', 'Dm7'] */
export function progression(src: string): string[] {
  return src
    .trim()
    .split(/\s+/)
    .filter((t) => t && t !== '|')
}

function parseChord(symbol: string): { pcs: number[]; bass: number } {
  const m = /^([A-G][b#]?)([^/]*)(?:\/([A-G][b#]?))?$/.exec(symbol)
  const intervals = m ? CHORD_INTERVALS[m[2]!] : undefined
  if (!m || !intervals) throw new Error(`看不懂的和弦：${symbol}`)
  const root = parsePitchClass(m[1]!)
  return {
    pcs: intervals.map((iv) => (root + iv) % 12),
    bass: m[3] ? parsePitchClass(m[3]) : root,
  }
}

const placeFrom = (pc: number, lo: number) => lo + ((pc - lo + 120) % 12)

/** 把和弦音排進 lo 起算的一個八度內，由低到高 */
export function voiceChord(symbol: string, lo: number): number[] {
  return parseChord(symbol)
    .pcs.map((pc) => placeFrom(pc, lo))
    .sort((a, b) => a - b)
}

interface ChordTrackOptions {
  lo: number
  beatsPerChord: number
  vel: number
}

/** pad 鋪底：每個和弦所有音一起長音 */
export function chordTrack(chords: string[], opts: ChordTrackOptions): NoteEvent[] {
  const notes: NoteEvent[] = []
  chords.forEach((symbol, c) => {
    for (const midi of voiceChord(symbol, opts.lo)) {
      notes.push({ beat: c * opts.beatsPerChord, midi, dur: opts.beatsPerChord, vel: clampVel(opts.vel + jitter(notes.length)) })
    }
  })
  return notes
}

interface BassOptions extends ChordTrackOptions {
  /** 每個和弦內的落點（拍） */
  hits: number[]
  dur: number
}

/** 低音：在指定拍點彈根音（斜線和弦彈斜線後的音），第一拍之後的落點較輕 */
export function bassLine(chords: string[], opts: BassOptions): NoteEvent[] {
  const notes: NoteEvent[] = []
  chords.forEach((symbol, c) => {
    const midi = placeFrom(parseChord(symbol).bass, opts.lo)
    for (const hit of opts.hits) {
      const accent = hit === 0 ? 1 : 0.8
      notes.push({ beat: c * opts.beatsPerChord + hit, midi, dur: opts.dur, vel: clampVel(opts.vel * accent + jitter(notes.length)) })
    }
  })
  return notes
}

interface ArpeggioOptions extends ChordTrackOptions {
  /** [和弦內拍點, 第幾個和弦音（從低到高，超出往上一個八度）, 拍數] */
  pattern: Array<[number, number, number]>
}

/** 分解和弦：依 pattern 從排好的和弦音中取音，可用同一拍多個音做出雙音或塊狀和弦 */
export function arpeggiate(chords: string[], opts: ArpeggioOptions): NoteEvent[] {
  const notes: NoteEvent[] = []
  chords.forEach((symbol, c) => {
    const tones = voiceChord(symbol, opts.lo)
    for (const [offset, index, dur] of opts.pattern) {
      const midi = tones[index % tones.length]! + 12 * Math.floor(index / tones.length)
      notes.push({ beat: c * opts.beatsPerChord + offset, midi, dur, vel: clampVel(opts.vel + jitter(notes.length)) })
    }
  })
  return notes
}
