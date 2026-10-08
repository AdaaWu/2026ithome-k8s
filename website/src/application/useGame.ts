import { computed, readonly, ref } from 'vue'
import { getTitle, isIslandRuler } from '@/domain/achievement'
import { isCorrectAnswer } from '@/domain/character'
import { TOTAL_DAYS } from '@/domain/level'
import {
  createEmptyProgress,
  markCharacterSeen,
  markDayCleared,
  setNickname,
  unlockCharacter,
  type GameProgress,
} from '@/domain/progress'
import { CHARACTERS } from '@/data/characters'
import { clearProgress, loadProgress, saveProgress } from '@/infrastructure/progressStorage'

const ALL_CHARACTER_IDS = CHARACTERS.map((c) => c.id)

const progress = ref<GameProgress>(loadProgress())

function commit(next: GameProgress) {
  progress.value = next
  saveProgress(next)
}

/** 全域遊戲狀態：所有頁面共用同一份存檔 */
export function useGame() {
  const title = computed(() => getTitle(progress.value, ALL_CHARACTER_IDS))
  const isRuler = computed(() => isIslandRuler(progress.value, ALL_CHARACTER_IDS))
  const clearedCount = computed(() => progress.value.clearedDays.length)
  const unlockedCount = computed(() => progress.value.unlockedCharacters.length)

  return {
    progress: readonly(progress),
    title,
    isRuler,
    clearedCount,
    unlockedCount,
    totalDays: TOTAL_DAYS,
    totalCharacters: ALL_CHARACTER_IDS.length,

    isDayCleared: (day: number) => progress.value.clearedDays.includes(day),
    isUnlocked: (id: string) => progress.value.unlockedCharacters.includes(id),
    isSeen: (id: string) => progress.value.seenCharacters.includes(id),

    setNickname: (name: string) => commit(setNickname(progress.value, name)),
    clearDay: (day: number) => commit(markDayCleared(progress.value, day)),
    seeCharacter: (id: string) => commit(markCharacterSeen(progress.value, id)),

    /** 回答圖鑑題目，答對就解鎖並回傳 true */
    answerCharacter(id: string, choice: string): boolean {
      const character = CHARACTERS.find((c) => c.id === id)
      if (!character) return false
      const correct = isCorrectAnswer(character, choice)
      commit(correct ? unlockCharacter(progress.value, id) : markCharacterSeen(progress.value, id))
      return correct
    },

    resetAll() {
      clearProgress()
      progress.value = createEmptyProgress()
    },

    /** 測試用：重新從儲存讀取，模擬重新整理頁面 */
    reloadFromStorage() {
      progress.value = loadProgress()
    },
  }
}
