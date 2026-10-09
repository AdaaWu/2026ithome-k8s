<script setup lang="ts">
import { useAudioSettings } from '@/application/useAudioSettings'

const { musicOn, sfxOn, toggleMusic, toggleSfx } = useAudioSettings()
</script>

<template>
  <div class="audio-toggles">
    <button
      class="audio-toggle audio-toggle--music"
      :class="{ 'is-off': !musicOn }"
      aria-label="背景音樂"
      :aria-pressed="musicOn"
      data-test="toggle-music"
      @click="toggleMusic"
    >
      🎵
    </button>
    <button
      class="audio-toggle"
      :class="{ 'is-off': !sfxOn }"
      aria-label="音效"
      :aria-pressed="sfxOn"
      data-test="toggle-sfx"
      @click="toggleSfx"
    >
      {{ sfxOn ? '🔊' : '🔇' }}
    </button>
  </div>
</template>

<style scoped>
.audio-toggles {
  display: flex;
  gap: 6px;
  flex: none;
}

.audio-toggle {
  position: relative;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 2px solid var(--ink-soft);
  border-radius: 50%;
  background: var(--paper);
  font-size: 1.2rem;
  line-height: 1;
  color: var(--ink);
  cursor: pointer;
  transition: opacity 0.2s;
}

.audio-toggle.is-off {
  opacity: 0.55;
}

/* 音樂關閉時在音符上畫一道斜線 */
.audio-toggle--music.is-off::after {
  content: '';
  position: absolute;
  width: 26px;
  height: 2.5px;
  border-radius: 2px;
  background: var(--ink);
  transform: rotate(-45deg);
}
</style>
