<script setup lang="ts">
import type { Tone } from './types'

// 舞台頂部的提示氣泡，點一下提早關閉
withDefaults(defineProps<{ text: string | null; tone?: Tone }>(), { tone: 'info' })
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Transition name="hint">
    <button v-if="text" type="button" class="hint" :class="`hint--${tone}`" role="status" @click="emit('close')">
      {{ text }}
    </button>
  </Transition>
</template>

<style scoped>
.hint {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  right: var(--space-2);
  z-index: 10;
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--ink-soft);
  border-radius: var(--radius-md);
  background: var(--cloud);
  box-shadow: var(--shadow-pop);
  font-size: 0.92rem;
  text-align: center;
}

.hint--good {
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 14%, var(--cloud));
}

.hint--bad {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, var(--cloud));
}

.hint-enter-active {
  animation: pop-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}

.hint-leave-active {
  transition: opacity 0.2s;
}

.hint-leave-to {
  opacity: 0;
}
</style>
