export type CharacterId = string

export type CharacterCategory =
  | 'world'
  | 'control-plane'
  | 'workload'
  | 'network'
  | 'config-storage'
  | 'ops'

export interface Character {
  id: CharacterId
  /** 雲之島上的角色名，例：小鳥 */
  name: string
  /** K8s 正式名稱，例：Container */
  k8sName: string
  /** 中文術語，例：容器 */
  zhTerm?: string
  category: CharacterCategory
  /** 影子狀態時顯示的謎題敘述 */
  riddle: string
  /** 答對後顯示的白話說明 */
  description: string
  /** 4 個選項 */
  options: string[]
  /** 正確選項，必須是 options 其中之一 */
  answer: string
  /** 第一次登場的 Day */
  debutDay: number
}

const normalize = (text: string) => text.trim().toLowerCase()

export function isCorrectAnswer(character: Character, choice: string): boolean {
  return normalize(choice) === normalize(character.answer)
}
