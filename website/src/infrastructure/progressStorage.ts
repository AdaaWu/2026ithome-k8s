import { createEmptyProgress, type GameProgress } from '@/domain/progress'

export const SAVE_KEY = 'k8s-cloud-island-save-v1'

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number')

function isValidProgress(data: unknown): data is GameProgress {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    d.version === 1 &&
    typeof d.nickname === 'string' &&
    isNumberArray(d.clearedDays) &&
    isStringArray(d.seenCharacters) &&
    isStringArray(d.unlockedCharacters)
  )
}

export function loadProgress(): GameProgress {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return createEmptyProgress()
    const data: unknown = JSON.parse(raw)
    return isValidProgress(data) ? data : createEmptyProgress()
  } catch {
    return createEmptyProgress()
  }
}

export function saveProgress(progress: GameProgress): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress))
  } catch {
    // 無痕模式或空間已滿時不中斷遊戲
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // 同上
  }
}
