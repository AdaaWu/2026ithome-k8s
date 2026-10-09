<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { playSfx } from '@/infrastructure/sfx'

// 選項卡：選錯的淡掉不可再點，答對後全部鎖定；換一組 options 自動重置
const props = withDefaults(
  defineProps<{
    options: Array<{ id: string; label: string; sub?: string }>
    answer: string | string[]
    columns?: 1 | 2
  }>(),
  { columns: 1 },
)
const emit = defineEmits<{ choose: [id: string, correct: boolean] }>()

const wrong = ref<string[]>([])
const solved = ref<string | null>(null)
const answers = computed(() => (Array.isArray(props.answer) ? props.answer : [props.answer]))

// 以選項 id 判斷是否換題，父層每次渲染產生新陣列也不會誤重置
watch(
  () => props.options.map((o) => o.id).join('|'),
  () => {
    wrong.value = []
    solved.value = null
  },
)

function choose(id: string) {
  const correct = answers.value.includes(id)
  if (correct) solved.value = id
  else wrong.value.push(id)
  playSfx(correct ? 'correct' : 'wrong')
  emit('choose', id, correct)
}
</script>

<template>
  <div class="choices" :class="`choices--${columns}`">
    <button
      v-for="opt in options"
      :key="opt.id"
      class="choice"
      :class="{ 'is-wrong': wrong.includes(opt.id), 'is-right': solved === opt.id }"
      :data-choice="opt.id"
      :disabled="solved !== null || wrong.includes(opt.id)"
      @click="choose(opt.id)"
    >
      <span class="choice__label">{{ opt.label }}</span>
      <small v-if="opt.sub" class="choice__sub">{{ opt.sub }}</small>
    </button>
  </div>
</template>

<style scoped>
.choices {
  display: grid;
  gap: var(--space-2);
}

.choices--2 {
  grid-template-columns: 1fr 1fr;
}

.choice {
  min-height: 48px;
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--ink-soft);
  border-radius: var(--radius-md);
  background: var(--paper);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  text-align: left;
  transition: opacity 0.2s, border-color 0.2s, background 0.2s;
}

.choice:active {
  transform: scale(0.97);
}

.choice__sub {
  font-size: 0.78rem;
  color: var(--ink-soft);
}

.choice.is-wrong {
  opacity: 0.4;
  animation: shake 0.4s;
}

.choice.is-right {
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 18%, var(--paper));
}

.choice:disabled {
  cursor: default;
}
</style>
