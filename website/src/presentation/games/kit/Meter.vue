<script setup lang="ts">
import type { ChipColor } from './types'

// 水平量表：主值填色、門檻線 marks、第二條細線 overlay
const props = defineProps<{
  value: number
  max: number
  label?: string
  unit?: string
  marks?: Array<{ at: number; label: string; color?: ChipColor }>
  overlay?: number
}>()

const COLOR: Record<ChipColor, string> = {
  red: 'var(--danger)',
  blue: 'var(--sky-deep)',
  green: 'var(--leaf-deep)',
  yellow: 'var(--gold)',
  purple: 'var(--purple)',
  gray: 'var(--ink-soft)',
}

const pct = (n: number) => (props.max > 0 ? `${Math.max(0, Math.min(100, (n / props.max) * 100))}%` : '0%')
</script>

<template>
  <div class="meter">
    <div class="meter__head">
      <span v-if="label">{{ label }}</span>
      <b>{{ value }}{{ unit }} / {{ max }}{{ unit }}</b>
    </div>
    <div class="meter__track" role="meter" :aria-valuenow="value" :aria-valuemax="max" aria-valuemin="0">
      <span class="meter__fill" :style="{ width: pct(value) }" />
      <span v-if="overlay !== undefined" class="meter__overlay" :style="{ width: pct(overlay) }" />
      <span
        v-for="(m, i) in marks"
        :key="i"
        class="meter__mark"
        :style="{ left: pct(m.at), '--mark-color': COLOR[m.color ?? 'gray'] }"
      />
    </div>
    <div v-if="marks?.length" class="meter__labels">
      <small
        v-for="(m, i) in marks"
        :key="i"
        :style="{ left: pct(m.at), color: COLOR[m.color ?? 'gray'] }"
      >{{ m.label }}</small>
    </div>
  </div>
</template>

<style scoped>
.meter {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.82rem;
}

.meter__head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.meter__head b {
  font-variant-numeric: tabular-nums;
}

.meter__track {
  position: relative;
  height: 16px;
  border: 2px solid var(--ink-soft);
  border-radius: 999px;
  background: var(--cloud);
  overflow: hidden;
}

.meter__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
  transition: width 0.3s ease;
}

.meter__overlay {
  position: absolute;
  left: 0;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  background: var(--ink);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.meter__mark {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  margin-left: -1.5px;
  background: var(--mark-color);
}

.meter__labels {
  position: relative;
  height: 1.2em;
}

.meter__labels small {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.7rem;
}
</style>
