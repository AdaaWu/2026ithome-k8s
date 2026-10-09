// 樂譜資料契約：作曲端只產出資料，播放引擎依此合成

export type SceneId = 'title' | 'map' | 'day' | 'codex' | 'ruler'

/** 合成樂器，音色由播放引擎實作 */
export type Instrument =
  | 'musicBox' // 音樂盒：清亮、短衰減的金屬感撥奏
  | 'felt' // 毛氈鋼琴：圓潤、溫暖、帶一點氣音
  | 'pad' // 柔和長音鋪底：慢起慢收
  | 'bass' // 溫暖低音：短促、圓
  | 'chime' // 風鈴：高音、稀疏點綴

export interface NoteEvent {
  /** 從曲子開頭算起的拍數，從 0 開始 */
  beat: number
  /** MIDI 音高，60 = 中央 C */
  midi: number
  /** 長度（拍） */
  dur: number
  /** 力度 0–1，預設 0.7 */
  vel?: number
}

export interface Track {
  instrument: Instrument
  notes: NoteEvent[]
  /** 音軌音量 0–1，預設 1 */
  gain?: number
}

export interface Score {
  id: SceneId
  bpm: number
  /** 一輪的總拍數，播完從頭循環 */
  lengthBeats: number
  tracks: Track[]
  /** 搖擺感 0–0.3，把反拍往後推，預設 0 */
  swing?: number
}
