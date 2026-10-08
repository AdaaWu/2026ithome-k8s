import { computed, ref, shallowRef, type Ref } from 'vue'

/** 順序點擊：點完最後一個回 'done'，之後再點也一律回 'done' */
export function useSequence<T extends string>(expected: T[]) {
  const sequence = shallowRef(expected)
  const index = ref(0)
  const done = computed(() => index.value >= sequence.value.length)

  function tap(id: T): 'ok' | 'wrong' | 'done' {
    if (done.value) return 'done'
    if (id !== sequence.value[index.value]) return 'wrong'
    index.value++
    return done.value ? 'done' : 'ok'
  }

  function reset(next?: T[]) {
    if (next) sequence.value = next
    index.value = 0
  }

  return { index: index as Readonly<Ref<number>>, done, tap, reset }
}
