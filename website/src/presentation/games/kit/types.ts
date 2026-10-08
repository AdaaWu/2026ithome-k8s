export type { CharacterId } from '@/domain/character'

export type GameStatus = 'intro' | 'playing' | 'won' | 'lost'

export type CharFx =
  | 'none' // 正常
  | 'dim' // 變暗（失效、停電、未選）
  | 'shake' // 左右晃（錯誤、重啟中）
  | 'pop' // 破掉縮小淡出（Pod 被刪）
  | 'bounce' // 彈出（新建立）
  | 'glow' // 外光暈（被選中、正確）
  | 'ghost' // 半透明虛線外框（尚未存在的位置、Pending）
  | 'gone' // 不顯示但保留佔位
  | 'red' // 紅色調（壞掉、Not Ready）
  | 'slow' // 動畫放慢（CPU throttle）

export type ChipColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'gray'

export type Tone = 'info' | 'good' | 'bad'
