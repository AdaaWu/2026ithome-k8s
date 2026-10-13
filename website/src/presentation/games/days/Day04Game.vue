<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, useSequence, useTimeouts, type CharFx, type CharacterId, type GameStatus } from '../kit'

// Day 4 燈塔村接力：依序點角色，把「要 3 顆泡泡」一路傳到樹上；每一棒都經過櫃台
const emit = defineEmits<{ complete: [] }>()

type Role = 'whistle' | 'lighthouse' | 'memory-tree' | 'tree-picker' | 'patrol-captain' | 'squirrel'

interface Step {
  id: Role
  ask: string
  why: string
}

const NAME: Record<Role, string> = {
  whistle: '哨子',
  lighthouse: '燈塔櫃台',
  'memory-tree': '記憶樹',
  'tree-picker': '選樹官',
  'patrol-captain': '巡邏隊長',
  squirrel: '管家松鼠',
}

const TO_PICKER: Step[] = [
  { id: 'lighthouse', ask: '隊長把補件登記到哪？', why: '隊長也只跟櫃台說話' },
  { id: 'tree-picker', ask: '誰決定泡泡掛哪棵樹？', why: '選樹官負責挑樹' },
  { id: 'lighthouse', ask: '選好的樹寫回哪？', why: '選樹結果寫回櫃台' },
  { id: 'squirrel', ask: '誰真的把泡泡吹出來？', why: '樹上的管家松鼠才動手' },
]

const ROUNDS: Array<{ task: string; steps: Step[] }> = [
  {
    task: '我要 3 顆泡泡',
    steps: [
      { id: 'whistle', ask: '誰發出這個需求？', why: '需求從你的哨子發出' },
      { id: 'lighthouse', ask: '需求先送到哪？', why: '所有話都先交給櫃台' },
      { id: 'patrol-captain', ask: '誰發現樹上少了 3 顆？', why: '隊長比對期望和現況' },
      ...TO_PICKER,
    ],
  },
  {
    task: '泡泡破了一顆',
    steps: [{ id: 'patrol-captain', ask: '誰發現少了 1 顆？', why: '隊長比對期望和現況' }, ...TO_PICKER],
  },
]

// 以中心點擺位，舞台基準 340×330
const SPOTS: Array<{ id: Role | 'tree'; cx: number; cy: number; size: number }> = [
  { id: 'tree', cx: 268, cy: 250, size: 120 },
  { id: 'lighthouse', cx: 170, cy: 62, size: 84 },
  { id: 'memory-tree', cx: 58, cy: 110, size: 64 },
  { id: 'tree-picker', cx: 282, cy: 110, size: 64 },
  { id: 'patrol-captain', cx: 170, cy: 170, size: 64 },
  { id: 'whistle', cx: 56, cy: 232, size: 60 },
  { id: 'squirrel', cx: 212, cy: 292, size: 48 },
]
const POD_SPOTS = [
  { cx: 238, cy: 205 },
  { cx: 272, cy: 190 },
  { cx: 306, cy: 205 },
]

const AHA = '巡邏隊長（Controller Manager）負責補齊，大家都透過燈塔櫃台（API Server）交談，吹泡泡的是管家松鼠（kubelet）。'

const placeOf = (cx: number, cy: number, size: number) => {
  const box = Math.max(size, 44)
  return { left: `${cx - box / 2}px`, top: `${cy - box / 2}px` }
}

const status = ref<GameStatus>('intro')
const round = ref(0)
const steps = computed(() => ROUNDS[round.value]!.steps)
const seq = useSequence<Role>(ROUNDS[0]!.steps.map((s) => s.id))
const hint = useHint(2400)

const pods = ref<Array<{ key: number; fx: CharFx }>>([])
const busy = ref(false)
const memoryGlow = ref(false)
const created = ref(false)
const shaking = ref<Role | null>(null)
const missCount = ref(0)

let podKey = 0
let completed = false
const { later } = useTimeouts()

const current = computed(() => steps.value[seq.index.value])
const progress = computed(() => ({ current: round.value + (seq.done.value ? 1 : 0), total: ROUNDS.length }))

function fxOf(id: Role | 'tree'): CharFx {
  if (id === shaking.value) return 'shake'
  if (id === 'memory-tree' && memoryGlow.value) return 'glow'
  return 'none'
}

function blowPod(delay: number) {
  later(() => {
    if (status.value !== 'playing') return
    pods.value.push({ key: ++podKey, fx: 'bounce' })
    playSfx('pop')
  }, delay)
}

function miss(id: Role) {
  const expected = current.value!
  missCount.value++
  playSfx('wrong')
  shaking.value = id
  later(() => (shaking.value = null), 400)
  if (id === 'memory-tree') hint.show('記憶樹只跟櫃台說話，櫃台會自己去寫', 'bad')
  else if (expected.id === 'lighthouse') hint.show('沒有任何一條線繞過櫃台', 'bad')
  else hint.show(`是${NAME[expected.id]}：${expected.why}`, 'bad')
}

function tap(id: Role) {
  if (status.value !== 'playing' || busy.value || seq.done.value) return
  const result = seq.tap(id)
  if (result === 'wrong') return miss(id)

  missCount.value = 0
  playSfx('tap')
  if (id === 'lighthouse') {
    // 每筆寫入都落在記憶樹（etcd）
    memoryGlow.value = true
    later(() => (memoryGlow.value = false), 600)
    if (round.value === 0 && !created.value) {
      created.value = true
      hint.show('櫃台回話了，但樹上還沒東西', 'info')
    }
  }
  if (result === 'done') finishRound()
}

function finishRound() {
  busy.value = true
  if (round.value === 0) {
    ;[0, 300, 600].forEach(blowPod)
    hint.show('管家松鼠吹出 3 顆泡泡！', 'good')
    later(breakOnePod, 2000)
    return
  }
  blowPod(0)
  hint.show('管家松鼠補回第 3 顆了！', 'good')
  later(() => {
    if (status.value === 'playing') status.value = 'won'
  }, 1500)
}

function breakOnePod() {
  if (status.value !== 'playing') return
  playSfx('pop')
  const victim = pods.value[1]!
  victim.fx = 'pop'
  hint.show('糟了，一顆泡泡破了！', 'bad')
  later(() => {
    if (status.value !== 'playing') return
    pods.value = pods.value.filter((p) => p !== victim)
    round.value = 1
    seq.reset(ROUNDS[1]!.steps.map((s) => s.id))
    busy.value = false
  }, 400)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="依序點角色，把需求傳到樹上"
    :status="status"
    :aha="AHA"
    :progress="progress"
    @start="status = 'playing'"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="village">
      <KChar
        v-for="spot in SPOTS"
        :key="spot.id"
        :id="spot.id as CharacterId"
        :size="spot.size"
        :fx="fxOf(spot.id)"
        :label="spot.id === 'tree' ? undefined : NAME[spot.id]"
        :disabled="spot.id === 'tree'"
        :data-role="spot.id"
        class="village__item"
        :class="{ 'is-flash': missCount >= 2 && current?.id === spot.id }"
        :style="placeOf(spot.cx, spot.cy, spot.size)"
        @tap="spot.id !== 'tree' && tap(spot.id)"
      />
      <KChar
        v-for="(pod, i) in pods"
        :key="pod.key"
        id="bubble"
        :size="40"
        :fx="pod.fx"
        disabled
        data-test="pod"
        class="village__item village__pod"
        :style="placeOf(POD_SPOTS[i]!.cx, POD_SPOTS[i]!.cy, 40)"
      />
      <TagChip v-if="created" text="櫃台已登記：要 3 顆泡泡" color="green" disabled class="village__created pop-in" />
    </div>

    <div class="task paper">
      <small class="task__label">任務卡：{{ ROUNDS[round]!.task }}</small>
      <p class="task__ask">{{ seq.done.value ? '完成！' : current?.ask }}</p>
    </div>
  </GameShell>
</template>

<style scoped>
.village {
  position: relative;
  flex: none;
  left: 50%;
  width: 340px;
  height: 330px;
  margin: 56px 0 0 -170px;
}

.village__item {
  position: absolute;
}

.village__item.is-flash :deep(.kchar__body) {
  animation: day04-flash 0.8s ease-in-out infinite;
}

@keyframes day04-flash {
  50% {
    filter: drop-shadow(0 0 6px var(--gold)) drop-shadow(0 0 12px var(--accent));
  }
}

.village__pod {
  pointer-events: none;
}

.village .village__created {
  position: absolute;
  left: 0;
  top: 286px;
  opacity: 1;
}

.task {
  margin: auto 12px 12px;
  padding: 10px 12px;
  text-align: center;
}

.task__label {
  color: var(--ink-soft);
}

.task__ask {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
}

/* 舞台以 340px 為準，窄螢幕等比縮小並收掉多出的高度 */
@media (max-width: 375px) {
  .village {
    transform: scale(0.92);
    transform-origin: top center;
    margin-bottom: -16px;
  }
}
</style>
