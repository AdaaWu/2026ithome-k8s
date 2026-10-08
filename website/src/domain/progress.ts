import type { CharacterId } from './character'
import { TOTAL_DAYS } from './level'

export const NICKNAME_MAX_LENGTH = 12

export interface GameProgress {
  version: 1
  nickname: string
  clearedDays: number[]
  seenCharacters: CharacterId[]
  unlockedCharacters: CharacterId[]
}

export function createEmptyProgress(): GameProgress {
  return { version: 1, nickname: '', clearedDays: [], seenCharacters: [], unlockedCharacters: [] }
}

export function normalizeNickname(raw: string): string {
  return Array.from(raw.trim()).slice(0, NICKNAME_MAX_LENGTH).join('')
}

const addUnique = <T>(list: T[], item: T): T[] => (list.includes(item) ? list : [...list, item])

export function setNickname(progress: GameProgress, raw: string): GameProgress {
  return { ...progress, nickname: normalizeNickname(raw) }
}

export function markDayCleared(progress: GameProgress, day: number): GameProgress {
  if (!Number.isInteger(day) || day < 1 || day > TOTAL_DAYS) return progress
  const clearedDays = addUnique(progress.clearedDays, day).sort((a, b) => a - b)
  return { ...progress, clearedDays }
}

export function markCharacterSeen(progress: GameProgress, id: CharacterId): GameProgress {
  return { ...progress, seenCharacters: addUnique(progress.seenCharacters, id) }
}

export function unlockCharacter(progress: GameProgress, id: CharacterId): GameProgress {
  const seen = markCharacterSeen(progress, id)
  return { ...seen, unlockedCharacters: addUnique(seen.unlockedCharacters, id) }
}
