import type { CharacterId } from './character'

export const TOTAL_DAYS = 30
export const CODEX_DAY = 31

export interface Act {
  id: number
  name: string
  days: [number, number]
}

export const ACTS: Act[] = [
  { id: 1, name: '第一幕｜登島', days: [1, 5] },
  { id: 2, name: '第二幕｜泡泡與小鳥', days: [6, 12] },
  { id: 3, name: '第三幕｜流量找得到人', days: [13, 18] },
  { id: 4, name: '第四幕｜帶著東西活下去', days: [19, 23] },
  { id: 5, name: '第五幕｜讓島自己運轉', days: [24, 28] },
  { id: 6, name: '第六幕｜收成', days: [29, 30] },
]

export interface DayLevel {
  day: number
  /** 文章標題 */
  title: string
  /** 今日 K8s 概念，例：Pod */
  concept: string
  /** 關卡開場劇情，2–3 句 */
  intro: string
  /** 過關後顯示的「帶走一句話」 */
  takeaway: string
  /** 文章主圖，放在 public/art */
  image: string
  /** 今日登場角色 */
  characters: CharacterId[]
  /** 小遊戲名稱 */
  gameTitle: string
  /** 一句話玩法說明 */
  gameHint: string
}

export function actOfDay(day: number): Act | undefined {
  return ACTS.find((act) => day >= act.days[0] && day <= act.days[1])
}
