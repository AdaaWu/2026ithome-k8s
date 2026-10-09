import { readonly, ref } from 'vue'
import { isMusicMuted, setMusicMuted } from '@/infrastructure/audio/bgm'
import { isMuted, setMuted } from '@/infrastructure/sfx'

const musicOn = ref(!isMusicMuted())
const sfxOn = ref(!isMuted())

/** 音樂與音效開關，各自存在瀏覽器；畫面只透過這裡改設定 */
export function useAudioSettings() {
  return {
    musicOn: readonly(musicOn),
    sfxOn: readonly(sfxOn),
    toggleMusic() {
      musicOn.value = !musicOn.value
      setMusicMuted(!musicOn.value)
    },
    toggleSfx() {
      sfxOn.value = !sfxOn.value
      setMuted(!sfxOn.value)
    },
  }
}
