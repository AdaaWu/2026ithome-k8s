<script setup lang="ts">
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import type { CharFx, CharacterId } from './types'

// 可點擊的角色；fx 以 CSS class 呈現，切換時動畫自動播一次
withDefaults(
  defineProps<{
    id: CharacterId
    size?: number
    fx?: CharFx
    label?: string
    badge?: string | number
    selected?: boolean
    disabled?: boolean
  }>(),
  { size: 64, fx: 'none', selected: false, disabled: false },
)
const emit = defineEmits<{ tap: [] }>()
</script>

<template>
  <button
    type="button"
    class="kchar"
    :class="[`kchar--${fx}`, { 'is-selected': selected }]"
    :disabled="disabled || fx === 'gone'"
    @click="emit('tap')"
  >
    <span class="kchar__body">
      <CharacterSprite :id="id" :size="size" />
      <span v-if="badge !== undefined" class="kchar__badge">{{ badge }}</span>
    </span>
    <span v-if="label" class="kchar__label">{{ label }}</span>
  </button>
</template>

<style scoped>
/* 點擊區至少 44×44，小尺寸角色也外擴 */
.kchar {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: none;
  background: none;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: var(--radius-md);
}

.kchar:disabled {
  cursor: default;
}

.kchar__body {
  position: relative;
  display: inline-flex;
  border-radius: 50%;
  transition: filter 0.25s, opacity 0.25s;
}

.kchar:not(:disabled):active .kchar__body {
  transform: scale(0.94);
}

.kchar.is-selected .kchar__body {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
  background: color-mix(in srgb, var(--accent-soft) 60%, transparent);
}

.kchar__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: var(--accent);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}

.kchar__label {
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cloud) 85%, transparent);
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--ink);
  white-space: nowrap;
}

.kchar--dim .kchar__body {
  filter: grayscale(0.7) brightness(0.85);
  opacity: 0.55;
}

.kchar--shake .kchar__body {
  animation: shake 0.4s;
}

.kchar--pop .kchar__body {
  animation: kchar-pop 0.35s ease-in forwards;
}

.kchar--bounce .kchar__body {
  animation: pop-in 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
}

.kchar--glow .kchar__body {
  filter: drop-shadow(0 0 4px var(--gold)) drop-shadow(0 0 10px var(--accent));
}

.kchar--ghost .kchar__body {
  opacity: 0.35;
  outline: 2px dashed var(--ink-soft);
  outline-offset: 2px;
}

.kchar--gone {
  visibility: hidden;
}

.kchar--red .kchar__body {
  filter: sepia(1) saturate(4) hue-rotate(-35deg) brightness(0.9);
}

/* 一格一格的慢動作，表現 CPU 被節流 */
.kchar--slow .kchar__body {
  animation: kchar-sluggish 2.4s steps(4) infinite;
}

@keyframes kchar-pop {
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(0);
    opacity: 0;
  }
}

@keyframes kchar-sluggish {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(-4px) rotate(-4deg);
  }
}
</style>
