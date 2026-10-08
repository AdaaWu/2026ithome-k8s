import type { CharacterId } from './character'
import { TOTAL_DAYS } from './level'
import type { GameProgress } from './progress'

export const RULER_TITLE = 'K8s 雲之島統治大王'

export function isIslandRuler(progress: GameProgress, allCharacterIds: CharacterId[]): boolean {
  const allDaysCleared = progress.clearedDays.length >= TOTAL_DAYS
  const allCollected = allCharacterIds.every(
    (id) => progress.seenCharacters.includes(id) && progress.unlockedCharacters.includes(id),
  )
  return allDaysCleared && allCollected
}

export function getTitle(progress: GameProgress, allCharacterIds: CharacterId[]): string {
  const days = progress.clearedDays.length
  if (isIslandRuler(progress, allCharacterIds)) return RULER_TITLE
  if (days >= TOTAL_DAYS) return '雲之島守護者'
  if (days >= 20) return '燈塔村見習生'
  if (days >= 10) return '泡泡吹手'
  if (days >= 1 || progress.unlockedCharacters.length >= 1) return '登島新手'
  return '迷路的旅人'
}
