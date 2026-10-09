<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, useSequence, useTimeouts, type GameStatus } from '../kit'

// Day 2 五分鐘登島：照順序點指令卡，Kind 蓋島、kubectl 對島說話
const emit = defineEmits<{ complete: [] }>()

type StepId = 'kind-create' | 'get-nodes' | 'run' | 'get-pods' | 'port-forward'
type DecoyId = 'kubectl-create-cluster' | 'docker-run'
type CmdId = StepId | DecoyId

interface Command {
  id: CmdId
  text: string
}

const STEPS: StepId[] = ['kind-create', 'get-nodes', 'run', 'get-pods', 'port-forward']

const COMMANDS: Command[] = [
  { id: 'kind-create', text: 'kind create cluster\n--name hello' },
  { id: 'get-nodes', text: 'kubectl get nodes' },
  { id: 'run', text: 'kubectl run hello\n--image=nginx:alpine' },
  { id: 'get-pods', text: 'kubectl get pods' },
  { id: 'port-forward', text: 'kubectl port-forward\npod/hello 8080:80' },
  { id: 'kubectl-create-cluster', text: 'kubectl create cluster' },
  { id: 'docker-run', text: 'docker run nginx' },
]

// 成功時終端機印出的真實輸出
const OK_OUTPUT: Record<StepId, string> = {
  'kind-create': 'Set kubectl context to "kind-hello"',
  'get-nodes': 'hello-control-plane   Ready',
  run: 'pod/hello created',
  'get-pods': 'hello   1/1   Running',
  'port-forward': 'Forwarding from 127.0.0.1:8080',
}

const OK_HINT: Record<StepId, string> = {
  'kind-create': '島蓋好了，哨子自動對準它',
  'get-nodes': '樹是 Ready，可以掛泡泡了',
  run: '泡泡正在拉 image…',
  'get-pods': 'Running！泡泡起來了',
  'port-forward': '瀏覽器連進泡泡了！',
}

// 順序錯時，提示下一步該做什麼
const NEXT_HINT: Record<StepId, string> = {
  'kind-create': '先用 Kind 蓋島',
  'get-nodes': '先 get nodes 確認樹 Ready',
  run: '還沒有泡泡，先 kubectl run',
  'get-pods': '先 get pods 看它 Running 沒',
  'port-forward': '最後用 port-forward 連進去',
}

// 泡泡還不存在時，這兩個指令的真實回應
function earlyOutput(id: StepId): string | undefined {
  if (doneCount.value >= 3) return undefined
  if (id === 'get-pods') return 'No resources found in default namespace.'
  if (id === 'port-forward') return 'Error from server (NotFound): pods "hello" not found'
  return undefined
}

const DECOY: Record<DecoyId, { output: string; hint: string }> = {
  'kubectl-create-cluster': {
    output: 'error: unknown command "cluster" for "kubectl create"',
    hint: '蓋島是 Kind 的事，kubectl 只負責說話',
  },
  'docker-run': {
    output: '（容器跑起來了，島完全不知道）',
    hint: '這容器不歸島管，沒有泡泡包著',
  },
}

const AHA = '島是 Kind 蓋的，之後都靠哨子（kubectl）說話。Kind 只負責蓋島和拆島，日常操作全部走 kubectl。'
const TERMINAL_MAX = 32

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

const clip = (s: string) => (s.length > TERMINAL_MAX ? `${s.slice(0, TERMINAL_MAX - 1)}…` : s)
const isStep = (id: CmdId): id is StepId => (STEPS as CmdId[]).includes(id)

const status = ref<GameStatus>('intro')
const cards = shuffle(COMMANDS)
const seq = useSequence<CmdId>(STEPS)
const hint = useHint(2600)
const terminal = ref('$ _')
const shaking = ref<CmdId | null>(null)
const missCount = ref(0)
// 最後一步完成到過關之間鎖住輸入
const locked = ref(false)

let completed = false
const { later } = useTimeouts()

const doneCount = computed(() => seq.index.value)
const nextStep = computed(() => STEPS[seq.index.value])
const isDone = (id: CmdId) => isStep(id) && STEPS.indexOf(id) < doneCount.value
const progress = computed(() => ({ current: doneCount.value, total: STEPS.length }))

function miss(id: CmdId, output: string | undefined, message: string) {
  missCount.value++
  playSfx('wrong')
  if (output) terminal.value = clip(output)
  shaking.value = id
  later(() => (shaking.value = null), 400)
  hint.show(message, 'bad')
}

function tapCommand(id: CmdId) {
  if (status.value !== 'playing' || locked.value || isDone(id)) return

  if (!isStep(id)) return miss(id, DECOY[id].output, DECOY[id].hint)

  // 島還沒蓋，kubectl 找不到 API Server
  if (doneCount.value === 0 && id !== 'kind-create') {
    return miss(id, 'The connection to the server localhost:8080 was refused', '島還沒蓋，哨子沒有對象')
  }

  const result = seq.tap(id)
  if (result === 'wrong') return miss(id, earlyOutput(id), NEXT_HINT[nextStep.value as StepId])

  missCount.value = 0
  playSfx(id === 'run' ? 'pop' : 'correct')
  terminal.value = clip(OK_OUTPUT[id])
  hint.show(OK_HINT[id], 'good')
  if (result !== 'done') return
  locked.value = true
  later(() => {
    if (status.value === 'playing') status.value = 'won'
  }, 1600)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="照順序點指令，蓋好島"
    :status="status"
    :aha="AHA"
    :progress="progress"
    @start="status = 'playing'"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="sea">
      <p v-if="doneCount === 0" class="sea__empty">一片海，什麼都還沒有</p>
      <template v-else>
        <KChar id="island" :size="210" fx="bounce" disabled class="sea__island" data-test="stage-island" />
        <KChar id="tree" :size="96" fx="bounce" disabled class="sea__tree" />
        <TagChip v-if="doneCount >= 2" text="Ready" color="green" class="sea__ready" disabled />
        <div v-if="doneCount >= 3" class="sea__pod">
          <KChar id="bubble" :size="64" fx="bounce" disabled :label="doneCount >= 4 ? 'Running' : 'ContainerCreating'" />
          <KChar id="bird" :size="28" disabled class="sea__bird" />
        </div>
        <TagChip
          v-if="doneCount >= 5"
          text="localhost:8080 → Welcome to nginx!"
          color="blue"
          mono
          class="sea__browser pop-in"
          disabled
        />
      </template>
    </div>

    <div class="terminal" data-test="terminal">{{ terminal }}</div>

    <div class="cards">
        <TagChip
          v-for="cmd in cards"
          :key="cmd.id"
          :text="cmd.text"
          mono
          :color="isDone(cmd.id) ? 'green' : 'gray'"
          :disabled="isDone(cmd.id)"
          :data-cmd="cmd.id"
          class="cards__chip"
          :class="{ shake: shaking === cmd.id, 'is-flash': missCount >= 2 && cmd.id === nextStep }"
          @tap="tapCommand(cmd.id)"
        />
    </div>
  </GameShell>
</template>

<style scoped>
.sea {
  position: relative;
  flex: 1;
  min-height: 210px;
  margin-top: 52px;
}

.sea__empty {
  position: absolute;
  inset: 40% 0 auto;
  margin: 0;
  text-align: center;
  color: var(--ink-soft);
  font-family: var(--font-display);
}

.sea__island {
  position: absolute;
  left: 50%;
  bottom: -40px;
  transform: translateX(-50%);
}

.sea__tree {
  position: absolute;
  left: calc(50% - 130px);
  bottom: 70px;
}

.sea__ready {
  position: absolute;
  left: calc(50% - 120px);
  bottom: 40px;
}

.sea__pod {
  position: absolute;
  left: calc(50% - 50px);
  bottom: 95px;
  display: grid;
  place-items: center;
}

.sea__bird {
  position: absolute;
  top: 10px;
  pointer-events: none;
}

.sea__browser {
  position: absolute;
  top: 0;
  right: 8px;
  left: 8px;
}

.terminal {
  position: relative;
  margin: 0 12px 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: #3b2f27;
  color: #c9f2b5;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 0.8rem;
  white-space: pre;
  overflow: hidden;
}

.cards {
  margin: 0 12px 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.cards .cards__chip {
  min-height: 46px;
  width: 100%;
  padding: 4px 6px;
  font-size: 0.72rem;
  white-space: pre-line;
  overflow-wrap: normal;
}

.sea .sea__ready:disabled,
.sea .sea__browser:disabled {
  opacity: 1;
}

.cards__chip.is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}
</style>
