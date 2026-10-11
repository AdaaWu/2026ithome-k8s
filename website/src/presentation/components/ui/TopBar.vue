<script setup lang="ts">
import AudioToggles from './AudioToggles.vue'

defineProps<{ title?: string; back?: string }>()
</script>

<template>
  <header class="topbar">
    <div class="topbar__side">
      <RouterLink v-if="back" :to="back" class="topbar__btn" aria-label="返回">‹</RouterLink>
    </div>
    <h1 class="topbar__title">{{ title }}</h1>
    <AudioToggles class="topbar__side" />
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
  min-width: 0;
  text-align: center;
  font-size: 1.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 左側只留返回鈕寬度，窄螢幕時標題才不會被截斷 */
.topbar__side {
  min-width: 44px;
  flex: none;
  display: flex;
}

.topbar__btn {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 2px solid var(--ink-soft);
  border-radius: 50%;
  background: var(--paper);
  font-size: 1.3rem;
  text-decoration: none;
  color: var(--ink);
}

/* 平板以上：列本身滿版，內容對齊頁面內容容器的左右邊 */
@media (min-width: 768px) {
  .topbar {
    padding: calc(12px + env(safe-area-inset-top)) max(24px, calc((100% - 720px) / 2)) 12px;
    background: color-mix(in srgb, var(--sky) 70%, transparent);
    border-bottom: 1.5px solid color-mix(in srgb, var(--ink-soft) 25%, transparent);
  }

  .topbar__title {
    font-size: clamp(1.15rem, 0.8rem + 0.7vw, 1.45rem);
  }
}

@media (min-width: 1024px) {
  .topbar {
    padding-left: max(32px, calc((100% - 1120px) / 2));
    padding-right: max(32px, calc((100% - 1120px) / 2));
  }
}

@media (min-width: 1024px) and (hover: hover) {
  .topbar__btn:hover {
    border-color: var(--ink);
  }
}
</style>
