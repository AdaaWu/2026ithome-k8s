<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { ChoiceCards, GameShell, HintBubble, KChar, Meter, TagChip, useHint, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 25 選樹官塞泡泡：只看 Request 加總排程，再判斷 CPU／記憶體超過 Limit 的下場
const emit = defineEmits<{ complete: [] }>()

type TreeId = 'A' | 'B' | 'C'

interface Req {
  cpu: number // m
  mem: number // Gi
}

const TREES: TreeId[] = ['A', 'B', 'C']
const ALLOCATABLE: Req = { cpu: 2000, mem: 4 }
// 樹上原本就有的 Request；實際用量刻意只有一成
const PRELOAD: Record<TreeId, Req> = { A: { cpu: 1000, mem: 1 }, B: { cpu: 500, mem: 3 }, C: { cpu: 0, mem: 0 } }
const USAGE_RATIO = 0.1
const QUEUE: Req[] = [
  { cpu: 500, mem: 1 },
  { cpu: 1000, mem: 2 },
  { cpu: 500, mem: 0.5 },
  { cpu: 1000, mem: 1 },
  { cpu: 1500, mem: 1 },
  { cpu: 2500, mem: 1 },
]
const MAX_MISSES = 2

const LIMIT_OPTIONS = [
  { id: 'throttle', label: '被限速（throttle），變慢但還在' },
  { id: 'oom', label: '被砍掉重啟（OOMKilled）' },
  { id: 'move', label: '被搬到別棵樹' },
]
const QUESTIONS = [
  { ask: 'CPU 用量衝過 Limit，會怎樣？', answer: 'throttle', why: { oom: 'CPU 可壓縮，只會被限速', move: '超過 Limit 不會換樹' } },
  { ask: '記憶體用量衝過 Limit，會怎樣？', answer: 'oom', why: { throttle: '記憶體不能壓縮，只能砍掉', move: '超過 Limit 不會換樹' } },
] as const

const AHA = '選樹官（Scheduler）只看 Request 加總，不看實際用量。CPU 超標會變慢，記憶體超標會被砍。'

const fmtMem = (gi: number) => (gi < 1 ? `${gi * 1024}Mi` : `${gi}Gi`)
const fmtReq = (r: Req) => `CPU ${r.cpu}m / 記憶體 ${fmtMem(r.mem)}`

const status = ref<GameStatus>('intro')
const phase = ref<'schedule' | 'limits'>('schedule')
const queueIndex = ref(0)
const placed = ref<Record<TreeId, Req[]>>({ A: [], B: [], C: [] })
const pending = ref<Req[]>([])
const misses = ref(0)
const stepMisses = ref(0)
const shaking = ref<TreeId | 'pending' | null>(null)
const question = ref(0)
const birdFx = ref<CharFx>('none')
const bubbleFx = ref<CharFx>('none')
const restarts = ref(0)
const hint = useHint(2600)

const { later: schedule, clearAll } = useTimeouts()
// 延遲回呼只在本局進行中才生效
const later = (fn: () => void, ms: number) =>
  schedule(() => {
    if (status.value === 'playing') fn()
  }, ms)
let completed = false

const current = computed(() => QUEUE[queueIndex.value])
const progress = computed(() => ({ current: queueIndex.value + question.value, total: QUEUE.length + QUESTIONS.length }))

function requested(tree: TreeId): Req {
  return placed.value[tree].reduce(
    (sum, r) => ({ cpu: sum.cpu + r.cpu, mem: sum.mem + r.mem }),
    { ...PRELOAD[tree] },
  )
}

// 回傳放不下的資源名稱，放得下回 null
function shortOf(tree: TreeId, pod: Req): 'cpu' | 'memory' | null {
  const used = requested(tree)
  if (used.cpu + pod.cpu > ALLOCATABLE.cpu) return 'cpu'
  if (used.mem + pod.mem > ALLOCATABLE.mem) return 'memory'
  return null
}

const fitting = computed(() => (current.value ? TREES.filter((t) => shortOf(t, current.value!) === null) : []))

function miss(target: TreeId | 'pending', message: string) {
  playSfx('wrong')
  misses.value++
  stepMisses.value++
  shaking.value = target
  later(() => (shaking.value = null), 400)
  hint.show(message, 'bad')
  if (misses.value > MAX_MISSES) status.value = 'lost'
}

function tapTree(tree: TreeId) {
  if (status.value !== 'playing' || phase.value !== 'schedule' || !current.value) return
  const lack = shortOf(tree, current.value)
  if (lack) return miss(tree, `Insufficient ${lack}：用量低沒用`)
  placed.value[tree].push(current.value)
  playSfx('pop')
  advance()
}

function tapPending() {
  if (status.value !== 'playing' || phase.value !== 'schedule' || !current.value) return
  if (fitting.value.length > 0) return miss('pending', `樹 ${fitting.value[0]} 還放得下`)
  pending.value.push(current.value)
  playSfx('correct')
  hint.show('沒有樹放得下，只能 Pending', 'good')
  advance()
}

function advance() {
  stepMisses.value = 0
  queueIndex.value++
  if (queueIndex.value < QUEUE.length) return
  later(() => {
    phase.value = 'limits'
    hint.show('這顆泡泡掛上了 Limit 線', 'info')
  }, 1000)
}

function choose(id: string, correct: boolean) {
  if (status.value !== 'playing') return
  const q = QUESTIONS[question.value]!
  if (!correct) return hint.show((q.why as Record<string, string>)[id] ?? '再想想', 'bad')
  question.value++
  if (q.answer === 'throttle') {
    birdFx.value = 'slow'
    hint.show('變慢了，但小鳥還在', 'good')
    return
  }
  birdFx.value = 'none'
  bubbleFx.value = 'pop'
  later(() => {
    bubbleFx.value = 'bounce'
    restarts.value++
    hint.show('OOMKilled，重啟一次', 'good')
    later(() => (status.value = 'won'), 1400)
  }, 500)
}

function retry() {
  clearAll()
  shaking.value = null
  phase.value = 'schedule'
  queueIndex.value = 0
  placed.value = { A: [], B: [], C: [] }
  pending.value = []
  misses.value = 0
  stepMisses.value = 0
  question.value = 0
  birdFx.value = 'none'
  bubbleFx.value = 'none'
  restarts.value = 0
  hint.clear()
  status.value = 'playing'
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="依 Request 把泡泡掛上樹"
    :status="status"
    :aha="AHA"
    lose-text="選樹官只看 Request 加總：先算樹上剩多少，都不夠才按 Pending。"
    :progress="progress"
    @start="status = 'playing'"
    @retry="retry"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="board">
      <div v-if="phase === 'schedule'" class="queue paper">
        <KChar id="tree-picker" :size="52" disabled label="選樹官" />
        <div class="queue__pod">
          <small class="queue__label">待排程 {{ Math.min(queueIndex + 1, QUEUE.length) }} / {{ QUEUE.length }}　錯 {{ misses }} / {{ MAX_MISSES }}</small>
          <div v-if="current" class="queue__row">
            <KChar id="bubble" :size="40" fx="bounce" :key="queueIndex" disabled />
            <TagChip :text="fmtReq(current)" color="yellow" mono disabled class="queue__req" />
          </div>
          <p v-else class="queue__done">排完了！</p>
        </div>
      </div>

      <div v-else class="zoom paper">
        <div class="zoom__pod">
          <KChar id="bubble" :size="64" :fx="bubbleFx" :badge="restarts ? `↻${restarts}` : undefined" disabled />
          <KChar id="bird" :size="30" :fx="birdFx" disabled class="zoom__bird" />
        </div>
        <KChar id="limit-line" :size="48" disabled />
        <div class="zoom__chips">
          <TagChip text="limits.cpu 500m" color="red" mono disabled />
          <TagChip text="limits.memory 1Gi" color="red" mono disabled />
        </div>
      </div>

      <div v-if="pending.length && phase === 'schedule'" class="pending-row">
        <KChar v-for="(_, i) in pending" :key="i" id="bubble" :size="32" fx="ghost" label="Pending" disabled />
      </div>

      <div class="grove">
        <div v-for="tree in TREES" :key="tree" class="grove__col">
          <div class="grove__pods">
            <KChar v-for="(_, i) in placed[tree]" :key="i" id="bubble" :size="24" fx="bounce" disabled />
          </div>
          <KChar
            id="tree"
            :size="68"
            :label="`樹 ${tree}`"
            :fx="shaking === tree ? 'shake' : 'none'"
            :selected="stepMisses >= 2 && fitting.includes(tree)"
            :disabled="phase !== 'schedule'"
            :data-tree="tree"
            @tap="tapTree(tree)"
          />
          <Meter
            unit="m"
            :value="requested(tree).cpu"
            :max="ALLOCATABLE.cpu"
            :overlay="requested(tree).cpu * USAGE_RATIO"
            class="grove__meter"
          />
          <Meter
            unit="Gi"
            :value="requested(tree).mem"
            :max="ALLOCATABLE.mem"
            :overlay="requested(tree).mem * USAGE_RATIO"
            class="grove__meter"
          />
        </div>
      </div>
      <small v-if="phase === 'schedule'" class="legend">上條 CPU、下條記憶體｜粗條 Request、細線實際用量</small>

      <div v-if="phase === 'limits' && question < QUESTIONS.length" class="quiz">
        <p class="quiz__ask">{{ QUESTIONS[question]!.ask }}</p>
        <ChoiceCards :key="question" :options="LIMIT_OPTIONS" :answer="QUESTIONS[question]!.answer" @choose="choose" />
      </div>
    </div>

    <template #controls>
      <button
        v-if="phase === 'schedule'"
        class="btn pending-btn"
        :class="{ shake: shaking === 'pending', 'is-flash': stepMisses >= 2 && fitting.length === 0 }"
        data-test="pending-btn"
        @click="tapPending"
      >
        沒有樹放得下（Pending）
      </button>
    </template>
  </GameShell>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 56px 10px 10px;
}

.queue,
.zoom {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
}

.queue__pod {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.queue__label {
  color: var(--ink-soft);
}

.queue__row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.board .queue__req:disabled {
  opacity: 1;
}

.queue__done {
  margin: 0;
  font-family: var(--font-display);
}

.zoom {
  justify-content: center;
}

.zoom__pod {
  position: relative;
  display: grid;
  place-items: center;
}

.zoom__bird {
  position: absolute;
  top: 10px;
}

.zoom__chips {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.zoom__chips :deep(.tag:disabled) {
  opacity: 1;
}

.pending-row {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.grove {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.grove__col {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
}

.grove__col > :deep(.kchar) {
  align-self: center;
}

.grove__pods {
  min-height: 26px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.grove__pods :deep(.kchar) {
  min-width: 24px;
  min-height: 24px;
}

.grove .grove__meter {
  font-size: 0.72rem;
  margin-top: 2px;
}

.legend {
  text-align: center;
  color: var(--ink-soft);
  font-size: 0.72rem;
}

.quiz__ask {
  margin: 0 0 6px;
  font-family: var(--font-display);
  text-align: center;
}

.pending-btn {
  width: 100%;
  min-height: 52px;
}

.pending-btn.is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}
</style>
