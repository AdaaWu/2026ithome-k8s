import { computed, ref, type Ref } from 'vue'

type RoundResult = 'ok' | 'miss' | null

/** 回合管理：目前回合、每回合結果 */
export function useRounds<T>(rounds: T[]) {
  const index = ref(0)
  const results = ref<RoundResult[]>(rounds.map(() => null))

  const current = computed(() => rounds[index.value] as T)
  const isLast = computed(() => index.value >= rounds.length - 1)

  function record(ok: boolean) {
    results.value[index.value] = ok ? 'ok' : 'miss'
  }

  function next(): boolean {
    if (isLast.value) return false
    index.value++
    return true
  }

  function reset() {
    index.value = 0
    results.value = rounds.map(() => null)
  }

  return {
    index: index as Readonly<Ref<number>>,
    current,
    results: results as Readonly<Ref<RoundResult[]>>,
    isLast,
    record,
    next,
    reset,
  }
}
