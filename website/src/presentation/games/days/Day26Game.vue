<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, Meter, TagChip, useHint, useRounds, useTimeouts, type GameStatus } from '../kit'

// Day 26 旋鈕心算王：用 HPA 公式算期望副本數，答對才看旋鈕改 replicas、控制器補泡泡
const emit = defineEmits<{ complete: [] }>()

interface Round {
  pods: number
  usage: number | null // null 代表沒設 Request，算不出使用率
  target: number
  max: number
  note?: string
  answer: string
  formula: string
}

const ROUNDS: Round[] = [
  { pods: 3, usage: 90, target: 50, max: 10, answer: '6', formula: '3×90÷50=5.4，無條件進位 6' },
  { pods: 2, usage: 100, target: 50, max: 3, answer: '3', formula: '算出 4，但被上限 3 擋住' },
  { pods: 4, usage: 52, target: 50, max: 10, answer: 'keep', formula: '52÷50=1.04，在 10% 容忍內' },
  { pods: 3, usage: null, target: 50, max: 10, note: '沒設 CPU Request', answer: 'unknown', formula: '沒設 Request，算不出使用率，HPA 不動作' },
  { pods: 6, usage: 20, target: 50, max: 10, note: '1 分鐘前才降下來', answer: 'keep', formula: '縮容要等 5 分鐘穩定窗口' },
]
const NUMBERS = ['2', '3', '4', '5', '6', '7', '8', '9', '10']
const MAX_MISSES = 2
const AHA = 'HPA 看的是用量除以 Request，調的是期望副本數；真正增減 Pod 的是工作負載控制器。擴容要時間，縮容刻意更慢。'
const LOSE_TEXT = '期望顆數 = 現有 × 使用率 ÷ 目標，無條件進位、不超過上限；再看預設 10% 容忍與 5 分鐘縮容穩定窗口。'

const status = ref<GameStatus>('intro')
const rounds = useRounds(ROUNDS)
const hint = useHint(3200)
const replicas = ref(ROUNDS[0]!.pods)
const bubbles = ref(ROUNDS[0]!.pods)
const turning = ref(false)
const locked = ref(false)
const missedThisRound = ref(false)
const shaking = ref<string | null>(null)
const roundMisses = ref(0)

const { later: schedule, clearAll: clearTimers } = useTimeouts()
// 延遲回呼只在本局進行中才生效
const later = (fn: () => void, ms: number) =>
  schedule(() => {
    if (status.value === 'playing') fn()
  }, ms)
let completed = false

const round = computed(() => rounds.current.value)
const misses = computed(() => rounds.results.value.filter((r) => r === 'miss').length)
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: ROUNDS.length,
}))

function loadRound() {
  hint.clear()
  replicas.value = round.value.pods
  bubbles.value = round.value.pods
  missedThisRound.value = false
  roundMisses.value = 0
  locked.value = false
}

function begin() {
  clearTimers()
  shaking.value = null
  turning.value = false
  rounds.reset()
  loadRound()
  status.value = 'playing'
}

function choose(id: string) {
  if (status.value !== 'playing' || locked.value) return
  if (id !== round.value.answer) {
    playSfx('wrong')
    roundMisses.value++
    shaking.value = id
    later(() => (shaking.value = null), 400)
    hint.show(round.value.formula, 'bad')
    if (!missedThisRound.value) {
      missedThisRound.value = true
      rounds.record(false)
      if (misses.value >= MAX_MISSES) status.value = 'lost'
    }
    return
  }
  if (!missedThisRound.value) rounds.record(true)
  playSfx('correct')
  locked.value = true
  hint.show(round.value.formula, 'good')
  const next = Number(round.value.answer)
  // 旋鈕只改 replicas 牌，0.5 秒後控制器才吹出泡泡
  if (!Number.isNaN(next)) {
    turning.value = true
    replicas.value = next
    later(() => {
      turning.value = false
      bubbles.value = next
      playSfx('pop')
    }, 600)
  }
  later(() => {
    if (rounds.next()) loadRound()
    else status.value = 'won'
  }, 2000)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="算出 HPA 要調到幾顆"
    :status="status"
    :aha="AHA"
    :lose-text="LOSE_TEXT"
    :progress="progress"
    @start="begin"
    @retry="begin"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="board">
      <KChar id="hpa-knob" :size="56" disabled class="board__knob" :class="{ 'is-turning': turning }" />
      <div class="board__data">
        <small data-test="round">第 {{ rounds.index.value + 1 }} 回合</small>
        <div class="board__chips">
          <TagChip :text="`現有 ${round.pods} 顆`" />
          <TagChip :text="`目標 ${round.target}%`" color="green" />
          <TagChip :text="`上限 ${round.max}`" color="yellow" />
        </div>
        <TagChip v-if="round.note" :text="round.note" color="red" />
      </div>
    </div>

    <div class="usage">
      <Meter
        v-if="round.usage !== null"
        :label="`平均 CPU 使用率（用量 ÷ Request）：${round.usage}%`"
        class="usage__meter"
        :value="round.usage"
        :max="120"
        unit="%"
        :marks="[{ at: round.target, label: '目標', color: 'green' }]"
      />
      <p v-else class="usage__unknown">平均使用率：<code>&lt;unknown&gt; / 50%</code></p>
    </div>

    <ul class="rules paper" data-test="rules">
      <li>期望顆數 = 現有 × 使用率 ÷ 目標，無條件進位，不超過上限</li>
      <li>比值在 0.9～1.1（預設容忍 10%）：維持不變</li>
      <li>縮容未滿 5 分鐘（預設穩定窗口）：維持不變</li>
      <li>&lt;unknown&gt;：算不出使用率，HPA 不動作</li>
    </ul>

    <div class="work">
      <div class="work__chain">
        <KChar id="steward" :size="40" disabled />
        <TagChip :text="`replicas: ${replicas}`" mono color="yellow" class="work__sign" :class="{ 'is-turning': turning }" />
        <span class="work__arrow">→</span>
        <KChar id="owl" :size="40" disabled />
      </div>
      <div class="work__pods">
        <KChar v-for="n in bubbles" :key="n" id="bubble" :size="30" :fx="n > round.pods ? 'bounce' : 'none'" disabled />
      </div>
    </div>

    <!-- 答案鍵放在舞台內，360x740 第一屏看得到全部按鍵 -->
    <div class="keys">
      <button
        v-for="n in NUMBERS"
        :key="n"
        class="btn keys__num"
        :class="{ shake: shaking === n, 'is-flash': roundMisses >= 2 && round.answer === n }"
        :data-answer="n"
        @click="choose(n)"
      >{{ n }}</button>
      <button
        class="btn keys__wide"
        :class="{ shake: shaking === 'keep', 'is-flash': roundMisses >= 2 && round.answer === 'keep' }"
        data-answer="keep"
        @click="choose('keep')"
      >維持不變</button>
      <button
        class="btn keys__wide keys__wide--full"
        :class="{ shake: shaking === 'unknown', 'is-flash': roundMisses >= 2 && round.answer === 'unknown' }"
        data-answer="unknown"
        @click="choose('unknown')"
      >算不出使用率（&lt;unknown&gt;）</button>
    </div>
  </GameShell>
</template>

<style scoped>
.board {
  margin: 56px 12px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.board__knob :deep(svg) {
  transition: transform 0.6s ease;
}

.board__knob.is-turning :deep(svg) {
  transform: rotate(60deg);
}

.board__data {
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.board__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* 360 寬也排成一行，答案鍵留在第一屏 */
.board__data :deep(.tag) {
  min-height: 30px;
  padding: 2px 8px;
  font-size: 0.8rem;
}

.usage {
  margin: 10px 12px 0;
}

.usage__meter :deep(.meter__head b) {
  display: none;
}

.usage__unknown {
  margin: 0;
  font-size: 0.9rem;
}

.rules {
  margin: 8px 12px 0;
  padding: 4px 8px 4px 20px;
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--ink-soft);
}

.work {
  margin: 6px 12px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.work__chain {
  display: flex;
  align-items: center;
  gap: 6px;
}

.work__sign {
  pointer-events: none;
  transition: transform 0.3s;
}

.work__sign.is-turning {
  transform: scale(1.2);
}

.work__arrow {
  color: var(--ink-soft);
  font-size: 1.2rem;
}

.work__pods {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.keys {
  margin: auto 10px 10px;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.keys__num {
  min-height: 48px;
  padding: 0;
}

.keys__wide {
  grid-column: span 3;
  min-height: 48px;
}

.keys__wide--full {
  grid-column: span 6;
}

.keys .is-flash {
  animation: day26-flash 0.8s ease-in-out infinite;
}

@keyframes day26-flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}
</style>
