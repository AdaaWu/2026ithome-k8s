<script setup lang="ts">
import { ref } from 'vue'
import { isMuted, setMuted } from '@/infrastructure/sfx'

defineProps<{ title?: string; back?: string }>()

const muted = ref(isMuted())
function toggleMute() {
  muted.value = !muted.value
  setMuted(muted.value)
}
</script>

<template>
  <header class="topbar">
    <RouterLink v-if="back" :to="back" class="topbar__btn" aria-label="返回">‹</RouterLink>
    <span v-else class="topbar__spacer" />
    <h1 class="topbar__title">{{ title }}</h1>
    <button class="topbar__btn" :aria-label="muted ? '開啟音效' : '關閉音效'" @click="toggleMute">
      {{ muted ? '🔇' : '🔊' }}
    </button>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
  background: color-mix(in srgb, var(--sky) 85%, transparent);
  backdrop-filter: blur(6px);
}

.topbar__title {
  flex: 1;
  text-align: center;
  font-size: 1.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar__btn,
.topbar__spacer {
  width: 44px;
  height: 44px;
  flex: none;
}

.topbar__btn {
  display: grid;
  place-items: center;
  border: 2px solid var(--ink-soft);
  border-radius: 50%;
  background: var(--paper);
  font-size: 1.3rem;
  text-decoration: none;
  color: var(--ink);
}
</style>
