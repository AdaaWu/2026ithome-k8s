<script setup lang="ts">
import type { ChipColor } from './types'

// 文字標籤：IP、label、指令、YAML 一律用它呈現
withDefaults(
  defineProps<{
    text: string
    color?: ChipColor
    mono?: boolean
    selected?: boolean
    strike?: boolean
    disabled?: boolean
  }>(),
  { color: 'gray', mono: false, selected: false, strike: false, disabled: false },
)
const emit = defineEmits<{ tap: [] }>()
</script>

<template>
  <button
    type="button"
    class="tag"
    :class="[`tag--${color}`, { 'is-mono': mono, 'is-selected': selected, 'is-strike': strike }]"
    :disabled="disabled"
    @click="emit('tap')"
  >
    {{ text }}
  </button>
</template>

<style scoped>
.tag {
  --tag-color: var(--ink-soft);
  position: relative;
  min-height: 34px;
  min-width: 44px;
  max-width: 100%;
  padding: 4px 12px;
  border: 2px solid var(--tag-color);
  border-radius: 999px;
  background: color-mix(in srgb, var(--tag-color) 16%, var(--cloud));
  color: var(--ink);
  font-size: 0.85rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
  transition: transform 0.12s, box-shadow 0.12s, opacity 0.2s;
}

/* 視覺 34px，點擊區外擴到 44px */
.tag::after {
  content: '';
  position: absolute;
  inset: -5px -2px;
}

.tag:not(:disabled):active {
  transform: scale(0.95);
}

.tag.is-mono {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 0.8rem;
  border-radius: var(--radius-sm);
}

.tag.is-selected {
  transform: translateY(-3px);
  box-shadow: 0 3px 0 var(--tag-color);
  border-width: 3px;
}

.tag.is-strike {
  text-decoration: line-through;
  opacity: 0.6;
}

.tag:disabled {
  cursor: default;
  opacity: 0.5;
}

.tag--red {
  --tag-color: var(--danger);
}

.tag--blue {
  --tag-color: var(--sky-deep);
}

.tag--green {
  --tag-color: var(--leaf-deep);
}

.tag--yellow {
  --tag-color: var(--gold);
}

/* tokens 沒有紫色，僅此處使用 */
.tag--purple {
  --tag-color: var(--purple);
}
</style>
