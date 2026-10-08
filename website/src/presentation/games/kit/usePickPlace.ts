import { shallowRef, type Ref } from 'vue'

export type PlaceResult<I, S> = { ok: true; item: I; slot: S } | { ok: false; reason: string }

/** 手機版的拖放：先點選物件，再點目標放下；放失敗時保留選取 */
export function usePickPlace<I extends string, S extends string>(
  opts: { canPlace?: (item: I, slot: S) => true | string } = {},
) {
  const picked = shallowRef<I | null>(null)

  function pick(item: I) {
    picked.value = picked.value === item ? null : item
  }

  function place(slot: S): PlaceResult<I, S> {
    const item = picked.value
    if (item === null) return { ok: false, reason: '先選一個' }
    const verdict = opts.canPlace?.(item, slot) ?? true
    if (verdict !== true) return { ok: false, reason: verdict }
    picked.value = null
    return { ok: true, item, slot }
  }

  function cancel() {
    picked.value = null
  }

  return { picked: picked as Readonly<Ref<I | null>>, pick, place, cancel }
}
