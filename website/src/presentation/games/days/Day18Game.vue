<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, useTimeouts, type CharFx, type CharacterId, type GameStatus } from '../kit'

// Day 18 封包旅行團：依序點出封包經過的站；柱子只翻出名單，改寫目的地的是出發那棵樹的道路管理員
const emit = defineEmits<{ complete: [] }>()

type PodId = 'p1' | 'p2' | 'p3'
type NodeId = 'gate-map' | 'gatekeeper' | 'totem' | 'road-a' | 'road-b' | 'tree-a' | 'tree-b' | PodId | 'lighthouse' | 'bird'
type Step = 'gatekeeper' | 'gate-map' | 'p1' | 'totem' | 'road-a' | 'pick' | 'tree' | 'pod' | 'bird'

interface SceneItem {
  node: NodeId | 'deco1' | 'deco2'
  id: CharacterId
  cx: number
  cy: number
  size: number
  label?: string
}

const PODS: Record<PodId, { ip: string; tree: 'tree-a' | 'tree-b' }> = {
  p1: { ip: '10.244.1.5', tree: 'tree-a' },
  p2: { ip: '10.244.2.7', tree: 'tree-b' },
  p3: { ip: '10.244.2.8', tree: 'tree-b' },
}
const SERVICE_IP = '10.96.123.45'

// 同畫面可點目標 12 個以內：每回合只開放路線上的角色加上道路管理員 B 當干擾
const ROUND_NODES: NodeId[][] = [
  ['gate-map', 'gatekeeper', 'totem', 'road-a', 'road-b', 'tree-a', 'tree-b', 'p1', 'p2', 'p3', 'bird'],
  ['p1', 'totem', 'road-a', 'road-b', 'tree-a', 'tree-b', 'p2', 'p3', 'bird'],
]

const ROUNDS: Array<{ title: string; steps: Step[]; start: string }> = [
  { title: '訪客打 http://你的網域/hello', steps: ['gatekeeper', 'gate-map', 'totem', 'road-a', 'pick', 'tree', 'pod', 'bird'], start: '你的網域/hello' },
  { title: 'P1 用名字呼叫 http://hello', steps: ['p1', 'totem', 'road-a', 'pick', 'tree', 'pod', 'bird'], start: 'hello' },
]

// 舞台基準 340×440，上方留給提示氣泡，以中心點擺位；橫向依舞台寬度等比換算
const SCENE: SceneItem[] = [
  { node: 'lighthouse', id: 'lighthouse', cx: 34, cy: 90, size: 44, label: '燈塔村' },
  { node: 'deco1', id: 'memory-tree', cx: 86, cy: 84, size: 30 },
  { node: 'deco2', id: 'tree-picker', cx: 86, cy: 124, size: 30 },
  { node: 'gate-map', id: 'gate-map', cx: 300, cy: 90, size: 50, label: '看板' },
  { node: 'totem', id: 'totem', cx: 186, cy: 140, size: 58, label: `hello ${SERVICE_IP}` },
  { node: 'tree-a', id: 'tree', cx: 88, cy: 300, size: 120, label: '樹 A' },
  { node: 'tree-b', id: 'tree', cx: 252, cy: 300, size: 120, label: '樹 B' },
  { node: 'gatekeeper', id: 'gatekeeper', cx: 52, cy: 264, size: 44, label: '守門員' },
  { node: 'p1', id: 'bubble', cx: 118, cy: 264, size: 48, label: 'P1' },
  { node: 'p2', id: 'bubble', cx: 222, cy: 264, size: 48, label: 'P2' },
  { node: 'p3', id: 'bubble', cx: 288, cy: 264, size: 48, label: 'P3' },
  { node: 'road-a', id: 'road-keeper', cx: 88, cy: 402, size: 48, label: '道路管理員 A' },
  { node: 'road-b', id: 'road-keeper', cx: 252, cy: 402, size: 48, label: '道路管理員 B' },
]
const AHA = '柱子（Service）IP 是虛擬入口，沒有網卡。道路管理員（kube-proxy）在出發那棵樹就把目的地改成真實的 Pod IP。'

const status = ref<GameStatus>('intro')
const hint = useHint(2600)
const roundIndex = ref(0)
const stepIndex = ref(0)
const picked = ref<PodId | null>(null)
const listShown = ref(false)
const packet = ref(ROUNDS[0]!.start)
const missCount = ref(0)
const fx = ref<Partial<Record<NodeId, CharFx>>>({})
const { later } = useTimeouts()

let completed = false

const round = computed(() => ROUNDS[roundIndex.value]!)
const step = computed(() => round.value.steps[stepIndex.value])
const expected = computed<NodeId | null>(() => {
  const s = step.value
  if (!s || s === 'pick') return null
  if (s === 'tree') return picked.value ? PODS[picked.value].tree : null
  if (s === 'pod') return picked.value
  return s
})
const visited = computed(() => new Set(round.value.steps.slice(0, stepIndex.value)))

const placeOf = (item: { cx: number; cy: number; size: number }) => {
  const box = Math.max(item.size, 44)
  return { left: `calc(${((item.cx / 340) * 100).toFixed(2)}% - ${box / 2}px)`, top: `${item.cy - box / 2}px` }
}
const isActive = (node: SceneItem['node']) => (ROUND_NODES[roundIndex.value] as string[]).includes(node)
// 挑 Endpoint 時舞台全部停用，只留名單可點
const isTappable = (node: SceneItem['node']) => isActive(node) && step.value !== 'pick'
const birdPlace = computed(() => {
  const pod = SCENE.find((s) => s.node === picked.value)
  return pod ? placeOf({ cx: pod.cx, cy: pod.cy - 4, size: 30 }) : {}
})

function play(node: NodeId, effect: CharFx) {
  fx.value = { ...fx.value, [node]: 'none' }
  later(() => (fx.value = { ...fx.value, [node]: effect }), 20)
}

function fxOf(node: SceneItem['node']): CharFx {
  if (node === 'deco1' || node === 'deco2' || !isActive(node)) return 'dim'
  return fx.value[node] ?? (visited.value.has(node as Step) ? 'glow' : 'none')
}

function advance(message: string) {
  playSfx('correct')
  hint.show(message, 'good')
  missCount.value = 0
  stepIndex.value++
  if (stepIndex.value < round.value.steps.length) return
  later(() => {
    if (status.value !== 'playing') return
    if (roundIndex.value === ROUNDS.length - 1) {
      playSfx('win')
      status.value = 'won'
      return
    }
    roundIndex.value++
    stepIndex.value = 0
    picked.value = null
    listShown.value = false
    fx.value = {}
    packet.value = round.value.start
  }, 1200)
}

function wrong(node: NodeId, message: string) {
  playSfx('wrong')
  play(node, 'shake')
  missCount.value++
  hint.show(message, 'bad')
}

function tap(node: SceneItem['node']) {
  if (node === 'deco1' || node === 'deco2') return
  if (status.value !== 'playing' || stepIndex.value >= round.value.steps.length || !isTappable(node)) return

  if (node !== expected.value) {
    if (node === 'road-b' && step.value === 'road-a') return wrong(node, '封包在出發那棵樹就被改寫')
    if (step.value === 'tree' && picked.value) return wrong(node, `${picked.value.toUpperCase()} 住在${PODS[picked.value].tree === 'tree-a' ? '樹 A' : '樹 B'}`)
    if (node === 'gate-map' && step.value === 'gatekeeper') return wrong(node, '看板只是規則表，要先有守門員讀它')
    if (node === 'totem') return wrong(node, '還沒輪到柱子，先走前一站')
    return wrong(node, '下一站不是這裡，想想順序')
  }

  play(node, 'glow')
  if (node === 'gatekeeper') return advance('守門員收下請求，去查看板規則')
  if (node === 'gate-map') {
    packet.value = `${SERVICE_IP}:80`
    return advance('看板規則：送往 hello 柱子')
  }
  if (step.value === 'p1') {
    packet.value = `${SERVICE_IP}:80`
    return advance('DNS 把 hello 換成柱子 IP')
  }
  if (node === 'totem') {
    listShown.value = true
    return advance('柱子沒網卡，只翻出名單')
  }
  if (node === 'road-a') return advance('道路管理員改寫目的地，挑一個')
  if (step.value === 'tree') return advance('封包送到 Pod 所在的樹')
  if (step.value === 'pod') return advance('抵達泡泡門牌，交給小鳥')
  return advance('小鳥收到請求！')
}

function pickEndpoint(pod: PodId) {
  if (status.value !== 'playing' || step.value !== 'pick') return
  picked.value = pod
  packet.value = `${PODS[pod].ip}:80`
  advance(PODS[pod].tree === 'tree-a' ? `目的地改成 ${pod.toUpperCase()} 的 IP` : '這棵樹不一定是收到請求的那棵')
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="依序點出封包經過的站"
    :status="status"
    :aha="AHA"
    :progress="{ current: roundIndex + (stepIndex >= round.steps.length ? 1 : 0), total: ROUNDS.length }"
    @start="status = 'playing'"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="scene">
      <KChar
        v-for="item in SCENE"
        :key="item.node"
        :id="item.id"
        :size="item.size"
        :label="item.label"
        :fx="fxOf(item.node)"
        :disabled="!isTappable(item.node)"
        :data-node="item.node"
        class="scene__item"
        :class="{ 'is-flash': missCount >= 2 && item.node === expected }"
        :style="placeOf(item)"
        @tap="tap(item.node)"
      />
      <KChar
        v-if="step === 'bird'"
        id="bird"
        :size="30"
        fx="bounce"
        data-node="bird"
        class="scene__item"
        :class="{ 'is-flash': missCount >= 2 }"
        :style="birdPlace"
        @tap="tap('bird')"
      />
      <!-- 名單放在柱子正下方，和角色同一屏 -->
      <div v-if="listShown" class="endpoints">
        <small>Endpoints</small>
        <TagChip
          v-for="(pod, id) in PODS"
          :key="id"
          :text="pod.ip"
          mono
          color="green"
          :selected="picked === id"
          :disabled="step !== 'pick'"
          :data-ep="id"
          class="endpoints__chip"
          :class="{ 'is-flash': step === 'pick' }"
          @tap="pickEndpoint(id)"
        />
      </div>
    </div>

    <template #controls>
      <div class="task paper">
        <small>第 {{ roundIndex + 1 }} 團：{{ round.title }}</small>
        <div class="task__row">
          <TagChip :text="`封包 dst ${packet}`" mono color="yellow" data-test="packet" disabled />
          <TagChip v-if="roundIndex === 1 && stepIndex > 0" :text="`DNS：hello → ${SERVICE_IP}`" mono color="purple" disabled />
        </div>
        <small v-if="roundIndex === 0" class="task__note">簡化路徑：不少 Controller 會直接讀名單送往 Pod</small>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.scene {
  position: relative;
  flex: none;
  width: 100%;
  max-width: 340px;
  height: 452px;
  margin: 0 auto;
}

.endpoints {
  position: absolute;
  top: 196px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.endpoints small {
  font-size: 0.68rem;
  color: var(--ink-soft);
}

.endpoints .endpoints__chip {
  padding: 2px 6px;
  font-size: 0.72rem;
  white-space: nowrap;
}

.endpoints__chip:disabled {
  opacity: 0.85;
}

.scene__item {
  position: absolute;
}

.scene__item:disabled {
  pointer-events: none;
}

.is-flash :deep(.kchar__body),
.endpoints .is-flash {
  animation: flash 0.9s ease-in-out infinite;
}

@keyframes flash {
  50% {
    filter: drop-shadow(0 0 8px var(--accent));
  }
}

.task {
  width: 100%;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.task :deep(.tag:disabled) {
  opacity: 0.85;
}

.task__note {
  color: var(--ink-soft);
  font-size: 0.7rem;
}
</style>
