import type { CharacterId } from './character'

export const TOTAL_DAYS = 30
export const CODEX_DAY = 31

export interface Act {
  id: number
  name: string
  days: [number, number]
  /** 本章目標 */
  goal: string
  /** 蓋完你會有 */
  result: string
}

export const ACTS: Act[] = [
  {
    id: 1,
    name: '第一幕｜登島',
    days: [1, 5],
    goal: '在筆電上蓋出第一座島，看懂島的結構，學會用哨子下指令',
    result: '一座跑著 Nginx hello 的 Kind 叢集',
  },
  {
    id: 2,
    name: '第二幕｜泡泡與小鳥',
    days: [6, 12],
    goal: '把服務正確包進泡泡，壞了有人補，換版不中斷，起不來會查',
    result: '由 Deployment 管理、能滾動更新與回滾的 hello',
  },
  {
    id: 3,
    name: '第三幕｜流量找得到人',
    days: [13, 18],
    goal: '讓請求不管泡泡怎麼換，都能從島外一路找到小鳥',
    result: 'Namespace、Service、Ingress 串好，瀏覽器打得到 hello',
  },
  {
    id: 4,
    name: '第四幕｜帶著東西活下去',
    days: [19, 23],
    goal: '把設定、密碼、資料搬出 image 與泡泡，泡泡換掉也不會忘',
    result: 'hello 加 Postgres 的雙層架構，資料活過 Pod',
  },
  {
    id: 5,
    name: '第五幕｜讓島自己運轉',
    days: [24, 28],
    goal: '島自己做健康檢查、分配資源、依流量擴縮，各種工作有專人管',
    result: '會自我修復、自動擴縮的島',
  },
  {
    id: 6,
    name: '第六幕｜收成',
    days: [29, 30],
    goal: '把 30 天的角色串成一張全島運作圖，再值一夜班總複習',
    result: '講得出 K8s 從下指令到資料落地的完整流程',
  },
]

/** 關卡任務簡報：動手前先看懂痛點、概念、操作與勝利條件 */
export interface DayBriefing {
  /** 情境痛點 */
  pain: string
  /** 概念白話定義，術語沿用 DayLevel.concept */
  conceptPlain: string
  /** 你的任務 */
  goal: string
  /** 怎麼玩，2–4 點 */
  steps: string[]
  /** 過關條件 */
  winCondition: string
  /** 玩完你會體會到 */
  insight: string
}

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
  /** 任務簡報 */
  briefing: DayBriefing
}

export function actOfDay(day: number): Act | undefined {
  return ACTS.find((act) => day >= act.days[0] && day <= act.days[1])
}
