import { getCurrentInstance, inject, ref, type InjectionKey, type Ref } from 'vue'

/** 關卡頁提供的暫停訊號，看簡報時為 true */
export const GAME_PAUSED: InjectionKey<Readonly<Ref<boolean>>> = Symbol('gamePaused')

/** 讀取暫停訊號；不在元件內或沒有提供者時永遠不暫停 */
export function useGamePaused(): Readonly<Ref<boolean>> {
  return (getCurrentInstance() ? inject(GAME_PAUSED, null) : null) ?? ref(false)
}
