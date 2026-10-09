// 五首背景音樂的樂譜資料，曲目設計見 specs/06-audio.md「曲目設計」
import { arpeggiate, bassLine, chordTrack, melody, progression } from './notation'
import type { SceneId, Score } from './score'

const BAR = 4

// title：F 大調開場，主題 A–C–D 往上展開，ruler 會再引用
const TITLE_CHORDS = progression(`
  Fmaj7  Bbadd9 Dm7    Csus2 |
  Fmaj7  Bbmaj7 Gm7    Csus2 |
  Bbadd9 F/A    Gm7    Fmaj7 |
  Bbmaj7 Am7    Gm7    Csus2
`)

const title: Score = {
  id: 'title',
  bpm: 72,
  lengthBeats: TITLE_CHORDS.length * BAR,
  tracks: [
    {
      instrument: 'musicBox',
      gain: 0.7,
      notes: melody(`
        A5:2 C6:1 D6:1           | C6:1.5 A5:0.5 F5:2     | G5:1 A5:1 C6:1.5 A5:0.5 | G5:3 r:1 |
        A5:2 C6:1 D6:1           | F6:2 D6:1 C6:1         | D6:1.5 C6:0.5 A5:1 G5:1 | C6:1 A5:1 G5:1 r:1 |
        D6:1 F6:1 G6:2           | F6:1.5 D6:0.5 C6:2     | D6:1 C6:1 A5:1 G5:1     | A5:3 r:1 |
        F5:1 G5:1 A5:1 C6:1      | D6:1.5 C6:0.5 A5:2     | G5:1 A5:1 C6:1 A5:1     | G5:3 r:1
      `, { vel: 0.6 }),
    },
    {
      instrument: 'felt',
      gain: 0.5,
      notes: arpeggiate(TITLE_CHORDS, {
        lo: 57,
        beatsPerChord: BAR,
        vel: 0.42,
        pattern: [
          [0, 0, 1.5],
          [1.5, 2, 1],
          [2.5, 4, 1.5],
        ],
      }),
    },
    { instrument: 'pad', gain: 0.45, notes: chordTrack(TITLE_CHORDS, { lo: 53, beatsPerChord: BAR, vel: 0.45 }) },
    {
      instrument: 'bass',
      gain: 0.55,
      notes: bassLine(TITLE_CHORDS, { lo: 40, beatsPerChord: BAR, hits: [0, 2], dur: 1.5, vel: 0.5 }),
    },
    {
      instrument: 'chime',
      gain: 0.3,
      notes: melody(`
        r:14 C7:1 A6:1 | r:16 |
        r:16 |
        r:12 F6:1 A6:1 C7:2 |
        r:16
      `, { vel: 0.4 }),
    },
  ],
}

// map：B♭ 大調散步，A 段音樂盒、B 段換毛氈鋼琴唱中音域
const MAP_CHORDS = progression(`
  Bbmaj7 Ebadd9 Bbmaj7 Fsus2  | Gm7    Ebmaj7 Cm7    Fsus4  |
  Bbmaj7 Ebadd9 Bbmaj7 Fsus2  | Gm7    Cm7    Fsus4  Bbadd9 |
  Ebmaj7 F      Dm7    Gm7    | Ebmaj7 F      Gm7    Fsus4  |
  Bbmaj7 Ebadd9 Bbmaj7 Fsus2  | Gm7    Cm7    Ebmaj7 Fsus4
`)

const MAP_A_OPEN = 'D6:1 C6:0.5 Bb5:0.5 C6:1 D6:1 | F6:1.5 D6:0.5 C6:2 | D6:0.5 F6:0.5 G6:1 F6:1 D6:1 |'

const map: Score = {
  id: 'map',
  bpm: 84,
  swing: 0.15,
  lengthBeats: MAP_CHORDS.length * BAR,
  tracks: [
    {
      instrument: 'musicBox',
      gain: 0.65,
      notes: melody(`
        ${MAP_A_OPEN} C6:3 r:1 |
        D6:1 Bb5:0.5 C6:0.5 D6:1 F6:1 | G6:1.5 F6:0.5 D6:1 C6:1 | Bb5:1 C6:1 D6:0.5 C6:0.5 Bb5:1 | C6:3 r:1 |
        ${MAP_A_OPEN} C6:2 D6:1 F6:1 |
        G6:2 F6:1 D6:1 | F6:1 D6:0.5 C6:0.5 Bb5:2 | C6:2 Bb5:1 C6:1 | Bb5:3 r:1 |
        r:32 |
        ${MAP_A_OPEN} C6:3 r:1 |
        D6:1 F6:1 G6:1.5 F6:0.5 | D6:1 C6:1 Bb5:1 G5:1 | Bb5:1.5 C6:0.5 D6:2 | C6:2 r:2
      `, { vel: 0.58 }),
    },
    {
      instrument: 'felt',
      gain: 0.5,
      notes: [
        // A 段：二、四拍輕點雙音，做出散步的步伐
        ...arpeggiate(MAP_CHORDS.slice(0, 16), {
          lo: 58,
          beatsPerChord: BAR,
          vel: 0.36,
          pattern: [
            [1, 1, 0.75],
            [1, 3, 0.75],
            [3, 1, 0.75],
            [3, 3, 0.75],
          ],
        }),
        // B 段：毛氈鋼琴接手旋律
        ...melody(`
          G4:1 Bb4:1 C5:1 D5:1 | C5:1.5 D5:0.5 C5:2 | F5:1 D5:1 A4:2 | Bb4:3 r:1 |
          G4:1 Bb4:1 D5:1 F5:1 | G5:1.5 F5:0.5 C5:2 | D5:1 F5:1 G5:1 F5:1 | F5:1 D5:1 C5:2
        `, { start: 64, vel: 0.55 }),
        ...arpeggiate(MAP_CHORDS.slice(24), {
          lo: 58,
          beatsPerChord: BAR,
          vel: 0.36,
          pattern: [
            [1, 1, 0.75],
            [1, 3, 0.75],
            [3, 1, 0.75],
            [3, 3, 0.75],
          ],
        }).map((n) => ({ ...n, beat: n.beat + 96 })),
      ],
    },
    { instrument: 'pad', gain: 0.4, notes: chordTrack(MAP_CHORDS, { lo: 53, beatsPerChord: BAR, vel: 0.4 }) },
    {
      instrument: 'bass',
      gain: 0.55,
      notes: bassLine(MAP_CHORDS, { lo: 40, beatsPerChord: BAR, hits: [0, 2], dur: 1, vel: 0.52 }),
    },
    {
      instrument: 'chime',
      gain: 0.3,
      notes: melody(`
        r:32 |
        r:28 Bb6:1 F6:1 D6:2 |
        r:16 | r:12 C7:2 G6:2 |
        r:32
      `, { vel: 0.38 }),
    },
  ],
}

// day：D 大調解謎背景，兩小節換一個和弦，只有零星幾個音
const DAY_CHORDS = progression('Dmaj7 Gadd9 Bm7 Asus2 | Dadd9 Gmaj7 Em7 Asus4')
const DAY_BARS_PER_CHORD = 2

const day: Score = {
  id: 'day',
  bpm: 66,
  lengthBeats: DAY_CHORDS.length * DAY_BARS_PER_CHORD * BAR,
  tracks: [
    {
      instrument: 'felt',
      gain: 0.45,
      notes: melody(`
        r:1 F#5:1.5 E5:1.5 | r:4 | r:2 D5:2 | B4:2 r:2 |
        r:1 F#5:1 A5:2 | r:4 | r:2 E5:4 r:2 |
        r:1 E5:1.5 F#5:1.5 | r:4 | r:2 B4:2 | D5:2 r:2 |
        r:1 B4:1.5 A4:1.5 | r:4 | r:2 E5:2 | r:4
      `, { vel: 0.46 }),
    },
    {
      instrument: 'pad',
      gain: 0.45,
      notes: chordTrack(DAY_CHORDS, { lo: 54, beatsPerChord: DAY_BARS_PER_CHORD * BAR, vel: 0.38 }),
    },
    {
      instrument: 'bass',
      gain: 0.5,
      notes: bassLine(DAY_CHORDS, { lo: 38, beatsPerChord: DAY_BARS_PER_CHORD * BAR, hits: [0], dur: 4, vel: 0.42 }),
    },
    {
      instrument: 'chime',
      gain: 0.25,
      notes: melody('r:15 A6:1 | r:28 | r:14 F#6:2 | r:4', { vel: 0.38 }),
    },
  ],
}

// codex：E♭ 大調帶 Lydian 色彩（還原 A），F/E♭ 與 A♭maj7#11 製造好奇感
const CODEX_CHORDS = progression(`
  Ebmaj7 F/Eb Ebmaj7 F/Eb    | Abmaj7 Gm7 Fm9 Bbsus4 |
  Ebmaj7 F/Eb Cm9    Abmaj7  | Abmaj7#11 Gm7 Fsus2 Bbsus4
`)

const codex: Score = {
  id: 'codex',
  bpm: 76,
  lengthBeats: CODEX_CHORDS.length * BAR,
  tracks: [
    {
      instrument: 'musicBox',
      gain: 0.65,
      notes: melody(`
        G5:0.5 r:0.5 Bb5:0.5 r:0.5 D6:2       | C6:1 A5:2 r:1          | G5:0.5 r:0.5 Bb5:0.5 r:0.5 Eb6:1 D6:1 | C6:3 r:1 |
        Eb6:1 G6:1 F6:1 Eb6:1                 | D6:2 Bb5:1 r:1         | C6:1 Bb5:1 G5:2                       | F5:3 r:1 |
        Bb5:0.5 r:0.5 D6:0.5 r:0.5 G6:2       | F6:0.5 r:0.5 A6:2 r:1  | G6:1.5 F6:0.5 D6:2                    | Eb6:1 C6:1 r:2 |
        C6:0.5 r:0.5 D6:0.5 r:0.5 Eb6:1 D6:1  | Bb5:1.5 A5:0.5 G5:2    | F5:1 G5:1 A5:2                        | Bb5:2 r:2
      `, { vel: 0.55 }),
    },
    {
      instrument: 'felt',
      gain: 0.45,
      // 低音域踮腳尖的斷奏，像在影子間探頭
      notes: arpeggiate(CODEX_CHORDS, {
        lo: 55,
        beatsPerChord: BAR,
        vel: 0.38,
        pattern: [
          [0, 1, 0.5],
          [1, 2, 0.5],
          [2, 1, 0.5],
          [3, 2, 0.5],
        ],
      }),
    },
    { instrument: 'pad', gain: 0.45, notes: chordTrack(CODEX_CHORDS, { lo: 51, beatsPerChord: BAR, vel: 0.4 }) },
    {
      instrument: 'bass',
      gain: 0.5,
      notes: bassLine(CODEX_CHORDS, { lo: 40, beatsPerChord: BAR, hits: [0], dur: 2, vel: 0.48 }),
    },
    {
      instrument: 'chime',
      gain: 0.3,
      notes: melody('r:6.5 A6:1 r:0.5 | r:28 | r:3 C7:1 | r:24', { vel: 0.4 }),
    },
  ],
}

// ruler：F 大調凱旋，用附點節奏重述 title 主題，第 10 小節攀到最高點
const RULER_CHORDS = progression(`
  Fadd9 Bbmaj7 C/E    Fmaj7  | Bbadd9 Gm7 Csus4  C     |
  Dm7   Bbmaj7 F/A    Bbmaj7 | Gm7    Am7 Bbmaj7 Csus2
`)

const ruler: Score = {
  id: 'ruler',
  bpm: 80,
  lengthBeats: RULER_CHORDS.length * BAR,
  tracks: [
    {
      instrument: 'musicBox',
      gain: 0.7,
      notes: melody(`
        A5:1.5 C6:0.5 D6:2   | F6:1.5 D6:0.5 C6:2 | D6:1 C6:1 A5:1 G5:1 | A5:3 r:1 |
        D6:1.5 F6:0.5 G6:2   | F6:1 G6:1 D6:2     | C6:1 D6:1 F6:2       | E6:3 r:1 |
        D6:1.5 C6:0.5 A5:1 C6:1 | D6:1 F6:1 A6:2  | G6:1.5 F6:0.5 C6:2   | D6:3 r:1 |
        Bb5:1 C6:1 D6:1 F6:1 | E6:1.5 D6:0.5 C6:2 | D6:1.5 C6:0.5 A5:2   | G5:3 r:1
      `, { vel: 0.62 }),
    },
    {
      instrument: 'felt',
      gain: 0.33,
      // 讚美詩式的二分音符和弦，撐起凱旋感但不用號角
      notes: arpeggiate(RULER_CHORDS, {
        lo: 60,
        beatsPerChord: BAR,
        vel: 0.4,
        pattern: [
          [0, 0, 2],
          [0, 1, 2],
          [0, 3, 2],
          [2, 0, 2],
          [2, 1, 2],
          [2, 3, 2],
        ],
      }),
    },
    { instrument: 'pad', gain: 0.45, notes: chordTrack(RULER_CHORDS, { lo: 53, beatsPerChord: BAR, vel: 0.45 }) },
    {
      instrument: 'bass',
      gain: 0.6,
      notes: bassLine(RULER_CHORDS, { lo: 40, beatsPerChord: BAR, hits: [0, 2], dur: 1.5, vel: 0.55 }),
    },
    {
      instrument: 'chime',
      gain: 0.3,
      notes: melody('r:30 C6:0.5 E6:0.5 G6:0.5 C7:0.5 | r:28 C6:0.5 D6:0.5 G6:0.5 A6:0.5', { vel: 0.42 }),
    },
  ],
}

export const SCORES: Record<SceneId, Score> = { title, map, day, codex, ruler }
