<script setup lang="ts">
import { computed } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import ConfettiBurst from '@/presentation/components/ui/ConfettiBurst.vue'
import type { GameStatus } from './types'

// 每日小遊戲外框：計時條、回合點、準備與勝敗覆蓋層；舞台內容由 Day 元件放進 slot
const props = withDefaults(
  defineProps<{
    hint: string
    status: GameStatus
    aha?: string
    winTitle?: string
    loseText?: string
    timer?: { remaining: number; total: number }
    progress?: { current: number; total: number }
  }>(),
  { winTitle: '過關！' },
)
const emit = defineEmits<{ start: []; retry: []; finish: [] }>()

const timerRatio = computed(() => (props.timer ? Math.max(0, Math.min(1, props.timer.remaining / props.timer.total)) : 0))

function press(event: 'start' | 'retry') {
  playSfx('tap')
  if (event === 'start') emit('start')
  else emit('retry')
}
</script>

<template>
  <div class="shell">
    <header v-if="progress || timer" class="shell__top">
      <div v-if="progress" class="shell__dots" aria-label="回合進度">
        <i
          v-for="n in progress.total"
          :key="n"
          data-test="shell-dot"
          :class="{ 'is-done': n <= progress.current }"
        />
      </div>
      <div v-if="timer" class="shell__timer">
        <span
          data-test="shell-timer"
          :class="{ 'is-urgent': timerRatio <= 0.3 }"
          :style="{ width: `${timerRatio * 100}%` }"
        />
      </div>
    </header>

    <div class="shell__stage">
      <slot />
    </div>

    <footer v-if="$slots.controls" class="shell__controls">
      <slot name="controls" />
    </footer>

    <div v-if="status === 'intro'" class="shell__overlay">
      <div class="shell__card paper pop-in">
        <p class="shell__eyebrow">準備好了嗎？</p>
        <p class="shell__text">{{ hint }}</p>
        <button class="btn btn--primary shell__btn" data-test="shell-start" @click="press('start')">開始 ▶</button>
      </div>
    </div>

    <div v-else-if="status === 'won'" class="shell__overlay">
      <ConfettiBurst />
      <div class="shell__card paper pop-in">
        <h3 class="shell__title">{{ winTitle }}</h3>
        <p v-if="aha" class="shell__aha">{{ aha }}</p>
        <button class="btn btn--primary shell__btn" data-test="shell-finish" @click="emit('finish')">收下這一課</button>
      </div>
    </div>

    <div v-else-if="status === 'lost'" class="shell__overlay">
      <div class="shell__card paper pop-in">
        <h3 class="shell__title">差一點點</h3>
        <p v-if="loseText" class="shell__text">{{ loseText }}</p>
        <button class="btn btn--primary shell__btn" data-test="shell-retry" @click="press('retry')">再玩一次</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.shell__top {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shell__dots {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.shell__dots i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--ink-soft);
  background: var(--cloud);
  transition: background 0.2s;
}

.shell__dots i.is-done {
  background: var(--accent);
  border-color: var(--ink);
}

.shell__timer {
  height: 10px;
  border-radius: 999px;
  border: 2px solid var(--ink-soft);
  background: var(--cloud);
  overflow: hidden;
}

.shell__timer span {
  display: block;
  height: 100%;
  background: var(--leaf);
  transition: width 0.1s linear;
}

.shell__timer span.is-urgent {
  background: var(--danger);
}

/* 高約 520px，矮螢幕縮短後交給頁面捲動 */
.shell__stage {
  position: relative;
  min-height: clamp(400px, 62dvh, 520px);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--sky) 0%, var(--cloud) 100%);
  border: 2px solid var(--ink-soft);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.shell__controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}

.shell__overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(107, 79, 58, 0.35);
}

.shell__card {
  width: min(100%, 340px);
  padding: var(--space-5) var(--space-4);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.shell__eyebrow {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.3rem;
}

.shell__title {
  font-size: 1.5rem;
  color: var(--accent);
}

.shell__text,
.shell__aha {
  margin: 0;
}

.shell__aha {
  font-family: var(--font-display);
  font-size: 1.05rem;
  text-align: left;
}

.shell__btn {
  width: 100%;
}
</style>
