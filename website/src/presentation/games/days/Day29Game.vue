<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { ChoiceCards, GameShell, HintBubble, KChar, TagChip, useHint, useSequence, useTimeouts, type CharFx, type CharacterId, type GameStatus } from '../kit'

// Day 29 全島五條線：說、想、做、送、留依序接通，最後燈塔村停電看誰還在跑
const emit = defineEmits<{ complete: [] }>()

type Role =
  | 'whistle' | 'lighthouse' | 'memory-tree' | 'tree-picker' | 'patrol-captain'
  | 'steward' | 'owl' | 'squirrel' | 'bubble' | 'bird' | 'ready-flag'
  | 'gate-map' | 'totem' | 'road-keeper' | 'borrow-slip' | 'warehouse' | 'food-bucket'

interface Line {
  verb: string
  title: string
  color: string
  steps: Array<{ id: Role; why: string }>
  decoys: Array<{ id: Role; why: string }>
  doneHint: string
  chain: string
}

const NAME: Record<Role, string> = {
  whistle: '哨子', lighthouse: '櫃台', 'memory-tree': '記憶樹', 'tree-picker': '選樹官', 'patrol-captain': '巡邏隊長',
  steward: '部署管家', owl: '貓頭鷹', squirrel: '松鼠', bubble: '泡泡', bird: '小鳥', 'ready-flag': '小旗子',
  'gate-map': '地圖看板', totem: '柱子', 'road-keeper': '道路管理員', 'borrow-slip': '借用單', warehouse: '倉庫', 'food-bucket': '食物桶',
}

const LINES: Line[] = [
  {
    verb: '說', title: '下指令', color: 'var(--accent)',
    steps: [
      { id: 'whistle', why: '你先吹哨子下指令' },
      { id: 'lighthouse', why: '指令先送到櫃台' },
      { id: 'memory-tree', why: '櫃台把期望寫進記憶樹' },
    ],
    decoys: [
      { id: 'tree-picker', why: '選樹官不收你的指令' },
      { id: 'squirrel', why: '松鼠不聽哨子，只看櫃台' },
    ],
    doneHint: '回了 created，島上可能什麼都還沒發生',
    chain: 'kubectl → API Server → etcd',
  },
  {
    verb: '想', title: '控制面做決定', color: '#a58bc9',
    steps: [
      { id: 'patrol-captain', why: '巡邏隊長先發現數量不對' },
      { id: 'steward', why: '隊長交代部署管家' },
      { id: 'owl', why: '管家交代貓頭鷹登記泡泡' },
      { id: 'tree-picker', why: '選樹官替泡泡挑樹' },
      { id: 'lighthouse', why: '挑好的樹寫回櫃台' },
    ],
    decoys: [
      { id: 'squirrel', why: '松鼠負責動手，不做決定' },
      { id: 'memory-tree', why: '記憶樹只跟櫃台說話' },
    ],
    doneHint: '每一步其實都經過櫃台，這裡省略',
    chain: 'Controller Manager → Deployment → ReplicaSet → Scheduler → API Server',
  },
  {
    verb: '做', title: 'Node 執行', color: 'var(--leaf-deep)',
    steps: [
      { id: 'squirrel', why: '松鼠看到自己樹上的活' },
      { id: 'bubble', why: '松鼠吹出泡泡' },
      { id: 'bird', why: '小鳥放進泡泡' },
      { id: 'ready-flag', why: '探針通過才升旗' },
    ],
    decoys: [
      { id: 'patrol-captain', why: '隊長只比對，不動手' },
      { id: 'tree-picker', why: '選樹官只挑樹，不動手' },
    ],
    doneHint: '這是全島唯一真的動手的地方',
    chain: 'kubelet → Pod → Container → Readiness Probe',
  },
  {
    verb: '送', title: '流量進來', color: 'var(--sky-deep)',
    steps: [
      { id: 'gate-map', why: '守門員（Ingress Controller）照大門地圖看板分流' },
      { id: 'totem', why: '看板挑一根柱子' },
      { id: 'road-keeper', why: '道路管理員把封包轉過去' },
      { id: 'bubble', why: '封包抵達泡泡' },
      { id: 'bird', why: '最後交給小鳥' },
    ],
    decoys: [
      { id: 'lighthouse', why: '流量不經過燈塔村' },
      { id: 'steward', why: '管家管副本，不轉送流量' },
    ],
    doneHint: '流量一路都沒經過燈塔村',
    chain: 'Ingress（守門員 Ingress Controller 執行）→ Service → kube-proxy → Pod → Container',
  },
  {
    verb: '留', title: '資料落地', color: 'var(--bark)',
    steps: [
      { id: 'bird', why: '小鳥要寫資料' },
      { id: 'borrow-slip', why: '先拿借用單' },
      { id: 'warehouse', why: '寫進地上的倉庫' },
    ],
    decoys: [
      { id: 'food-bucket', why: '食物桶（emptyDir）跟著泡泡一起消失' },
      { id: 'bubble', why: '寫在泡泡裡，破了就沒了' },
    ],
    doneHint: '倉庫蓋在地上，泡泡破了它還在',
    chain: 'Container → PVC → PV',
  },
]

const QUESTIONS = [
  {
    ask: '燈塔村停電！已在跑的泡泡還接客嗎？',
    options: [
      { id: 'yes', label: '會，松鼠和道路管理員照常運作' },
      { id: 'no', label: '不會，全島跟著停擺' },
    ],
    answer: 'yes',
    why: '決定和執行分開，樹上照跑',
  },
  {
    ask: '停電時一棵巢樹倒了，上面的泡泡會搬到別棵樹嗎？',
    options: [
      { id: 'no', label: '不會，巡邏隊長停了沒人補' },
      { id: 'yes', label: '會，別棵樹的松鼠會接手' },
    ],
    answer: 'no',
    why: '松鼠只顧自己那棵樹，發現少一顆要補的是隊長，它停了',
  },
]

// 以中心點擺位，橫向以 340 為基準換成百分比、縱向 300px；五欄四列，燈塔村佔中間兩欄的上兩列
const MAP_W = 340
const MAP_H = 300
const COL = [34, 100, 168, 236, 304]
const ROW = [32, 104, 176, 248]
const at = (c: number, r: number) => ({ x: COL[c]!, y: ROW[r]! })
const SPOT: Record<Role, { x: number; y: number }> = {
  whistle: at(0, 0), lighthouse: at(1, 0), 'memory-tree': at(2, 0), steward: at(3, 0), 'gate-map': at(4, 0),
  'patrol-captain': at(1, 1), 'tree-picker': at(2, 1), owl: at(3, 1), totem: at(4, 1),
  squirrel: at(0, 2), bubble: at(1, 2), bird: at(2, 2), 'ready-flag': at(3, 2), 'road-keeper': at(4, 2),
  'food-bucket': at(1, 3), 'borrow-slip': at(2, 3), warehouse: at(3, 3),
}
const ROLES = Object.keys(SPOT) as Role[]
const VILLAGE: Role[] = ['lighthouse', 'memory-tree', 'tree-picker', 'patrol-captain']
const SIZE = 40

const AHA = '你說、村裡想、樹上做、道路管理員（kube-proxy）送、倉庫（PV）留。決定和執行分開，所以燈塔村停電時，樹上的服務還在跑。'

const status = ref<GameStatus>('intro')
const lineIndex = ref(0)
const phase = ref<'lines' | 'blackout'>('lines')
const question = ref(0)
const busy = ref(false)
const created = ref(false)
// 剛接通那條線的 K8s 名稱鏈，放在任務卡不蓋住地圖
const lastChain = ref<string | null>(null)
const shaking = ref<Role | null>(null)
const missCount = ref(0)
const seq = useSequence<Role>(LINES[0]!.steps.map((s) => s.id))
const hint = useHint(2600)

const { later: schedule } = useTimeouts()
// 延遲回呼只在本局進行中才生效
const later = (fn: () => void, ms: number) =>
  schedule(() => {
    if (status.value === 'playing') fn()
  }, ms)
let completed = false

const line = computed(() => LINES[Math.min(lineIndex.value, LINES.length - 1)]!)
const expected = computed(() => line.value.steps[seq.index.value])
const active = computed(() => new Set<Role>([...line.value.steps.map((s) => s.id), ...line.value.decoys.map((d) => d.id)]))
const progress = computed(() => ({ current: lineIndex.value + question.value, total: LINES.length + QUESTIONS.length }))

const pointsOf = (ids: Role[]) => ids.map((id) => `${SPOT[id].x},${SPOT[id].y}`).join(' ')
const doneLines = computed(() => LINES.slice(0, lineIndex.value))
const partial = computed(() => (phase.value === 'lines' ? line.value.steps.slice(0, seq.index.value).map((s) => s.id) : []))

const isTappable = (id: Role) => phase.value === 'lines' && !busy.value && active.value.has(id)

function fxOf(id: Role): CharFx {
  if (shaking.value === id) return 'shake'
  if (phase.value === 'blackout') return VILLAGE.includes(id) ? 'dim' : 'none'
  if (!active.value.has(id)) return 'dim'
  return partial.value.includes(id) ? 'glow' : 'none'
}

function tap(id: Role) {
  if (status.value !== 'playing' || !isTappable(id)) return
  const result = seq.tap(id)
  if (result === 'wrong') return miss(id)

  missCount.value = 0
  playSfx('tap')
  if (result === 'done') completeLine()
}

function miss(id: Role) {
  missCount.value++
  playSfx('wrong')
  shaking.value = id
  later(() => (shaking.value = null), 400)
  const decoy = line.value.decoys.find((d) => d.id === id)
  hint.show(decoy ? decoy.why : `順序不對：${expected.value!.why}`, 'bad')
}

function completeLine() {
  busy.value = true
  playSfx('correct')
  if (lineIndex.value === 0) created.value = true
  lastChain.value = line.value.chain
  hint.show(line.value.doneHint, 'good')
  later(() => {
    lineIndex.value++
    busy.value = false
    if (lineIndex.value < LINES.length) return seq.reset(LINES[lineIndex.value]!.steps.map((s) => s.id))
    phase.value = 'blackout'
    playSfx('wrong')
  }, 1200)
}

function choose(_id: string, correct: boolean) {
  if (status.value !== 'playing') return
  const q = QUESTIONS[question.value]!
  if (!correct) return hint.show(q.why, 'bad')
  later(() => {
    question.value++
    if (question.value < QUESTIONS.length) return
    // 先讓玩家看一眼接好的全島圖，再跳過關
    hint.show('五條線全通：說、想、做、送、留', 'good', 2600)
    later(() => (status.value = 'won'), 2600)
  }, 700)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="依序點角色，接通五條線"
    :status="status"
    :aha="AHA"
    :progress="progress"
    @start="status = 'playing'"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="map" :class="{ 'is-blackout': phase === 'blackout' }">
      <div class="map__village">燈塔村</div>
      <KChar id="tree" :size="72" disabled class="map__tree" />
      <svg class="map__lines" :viewBox="`0 0 ${MAP_W} ${MAP_H}`" preserveAspectRatio="none" aria-hidden="true">
        <polyline
          v-for="l in doneLines"
          :key="l.verb"
          :points="pointsOf(l.steps.map((s) => s.id))"
          :stroke="l.color"
          data-test="line-done"
        />
        <polyline v-if="partial.length > 1" :points="pointsOf(partial)" :stroke="line.color" class="is-partial" />
      </svg>
      <KChar
        v-for="id in ROLES"
        :key="id"
        :id="id as CharacterId"
        :size="SIZE"
        :label="NAME[id]"
        :fx="fxOf(id)"
        :disabled="!isTappable(id)"
        :selected="missCount >= 2 && expected?.id === id"
        :data-role="id"
        class="map__role"
        :class="{ 'is-off': phase === 'lines' && !active.has(id) }"
        :style="{ left: `${(SPOT[id].x / MAP_W) * 100}%`, top: `${SPOT[id].y - SIZE / 2}px` }"
        @tap="tap(id)"
      />
      <TagChip v-if="created" text="created" color="green" mono disabled class="map__created pop-in" />
    </div>

    <div v-if="phase === 'lines'" class="task paper">
      <b class="task__verb" :style="{ background: line.color }">{{ line.verb }}</b>
      <div>
        <small class="task__label">線 {{ lineIndex + 1 }} / {{ LINES.length }}</small>
        <p class="task__title">{{ line.title }}：下一站是誰？</p>
        <small v-if="lastChain" class="chain" data-test="chain">剛接通：{{ lastChain }}</small>
      </div>
    </div>

    <div v-else-if="question < QUESTIONS.length" class="quiz">
      <small v-if="lastChain && question === 0" class="chain" data-test="chain">剛接通：{{ lastChain }}</small>
      <p class="quiz__ask">{{ QUESTIONS[question]!.ask }}</p>
      <ChoiceCards :key="question" :options="QUESTIONS[question]!.options" :answer="QUESTIONS[question]!.answer" @choose="choose" />
    </div>
  </GameShell>
</template>

<style scoped>
.map {
  position: relative;
  flex: none;
  width: 100%;
  max-width: 340px;
  height: 300px;
  margin: 56px auto 0;
}

.map__village {
  position: absolute;
  left: 19%;
  top: -6px;
  width: 41%;
  height: 146px;
  padding: 2px 6px;
  border: 2px dashed var(--ink-soft);
  border-radius: var(--radius-md);
  font-size: 0.68rem;
  color: var(--ink-soft);
  transition: background 0.4s;
}

.map.is-blackout .map__village {
  background: rgba(60, 45, 35, 0.35);
}

.map__tree {
  position: absolute;
  left: -2px;
  top: 212px;
  opacity: 0.55;
}

.map__lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.map__lines polyline {
  fill: none;
  vector-effect: non-scaling-stroke;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.7;
}

.map__lines polyline.is-partial {
  stroke-dasharray: 8 6;
}

.map__role {
  position: absolute;
  transform: translateX(-50%);
  transition: transform 0.25s;
}

.map__role :deep(.kchar__label) {
  position: relative;
  font-size: 0.7rem;
  white-space: nowrap;
  background: var(--cloud);
}

/* 只縮角色本體，標籤維持可讀字級 */
.map__role.is-off :deep(.kchar__body) {
  transform: scale(0.78);
}

.map .map__created {
  position: absolute;
  left: 0;
  top: 78px;
  min-height: 24px;
  padding: 1px 6px;
  font-size: 0.7rem;
  opacity: 1;
}

.task {
  margin: auto 12px 12px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.task__verb {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-family: var(--font-display);
  font-size: 1.4rem;
}

.task__label {
  color: var(--ink-soft);
}

.task__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
}

.quiz {
  margin: auto 12px 12px;
}

.chain {
  display: block;
  color: var(--ink-soft);
  font-size: 0.72rem;
  line-height: 1.35;
}

.quiz .chain {
  margin-bottom: 4px;
  text-align: center;
}

.quiz__ask {
  margin: 0 0 6px;
  font-family: var(--font-display);
  text-align: center;
}
</style>
