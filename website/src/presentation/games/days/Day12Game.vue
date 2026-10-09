<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import { ChoiceCards, GameShell, HintBubble, KChar, TagChip, useHint, useRounds, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 12 泡泡急診室：get 看狀態 → describe 看 Events → logs 看程式，用最少檢查找出病因
const emit = defineEmits<{ complete: [] }>()

type Tool = 'describe' | 'logs' | 'previous'
type Diagnosis = 'image' | 'config' | 'node'

interface Patient {
  id: 'pull' | 'crash' | 'pending'
  name: string
  status: string
  restarts: number
  fx: CharFx
  output: Record<Tool, string[]>
  answer: Diagnosis
  tool: Tool
  clue: string
}

const MAX_CHECKS = 7

const PATIENTS: Patient[] = [
  {
    id: 'pull',
    name: 'web-7c4d',
    status: 'ImagePullBackOff',
    restarts: 0,
    fx: 'dim',
    output: {
      describe: ['Warning  Failed', 'Failed to pull image', '"nginx:1.277": not found'],
      logs: ['container "web" is waiting', 'to start: trying and failing', 'to pull image'],
      previous: ['Error: previous terminated', 'container "web" not found'],
    },
    answer: 'image',
    tool: 'describe',
    clue: '回頭看 Events：拉不到 image',
  },
  {
    id: 'crash',
    name: 'web-9f2k',
    status: 'CrashLoopBackOff',
    restarts: 5,
    fx: 'red',
    output: {
      describe: ['Warning  BackOff', 'Back-off restarting failed', 'container web'],
      logs: ['starting server...'],
      previous: ['starting server...', 'Error: DATABASE_URL is not set'],
    },
    answer: 'config',
    tool: 'previous',
    clue: 'RESTARTS 在跳，看上一輪 logs',
  },
  {
    id: 'pending',
    name: 'web-3m8x',
    status: 'Pending',
    restarts: 0,
    fx: 'ghost',
    output: {
      describe: ['Warning  FailedScheduling', '0/3 nodes are available:', '3 Insufficient memory.'],
      logs: ['(空白，泡泡還沒掛上樹)'],
      previous: ['Error: previous terminated', 'container "web" not found'],
    },
    answer: 'node',
    tool: 'describe',
    clue: 'Events 寫了 FailedScheduling',
  },
]

const TOOLS: Array<{ id: Tool; label: string }> = [
  { id: 'describe', label: 'describe' },
  { id: 'logs', label: 'logs' },
  { id: 'previous', label: 'logs --previous' },
]

const DIAGNOSES = [
  { id: 'image', label: 'image tag 打錯' },
  { id: 'config', label: '程式啟動時缺設定' },
  { id: 'node', label: '沒有樹放得下' },
]

const AHA = 'Events 是 K8s 說的，logs 是程式說的。容器沒起來就沒 logs；一直重啟就用 --previous 看上一輪。'

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

const status = ref<GameStatus>('intro')
const rounds = useRounds(shuffle(PATIENTS))
const hint = useHint(2600)

const checks = ref(0)
const lastTool = ref<Tool | null>(null)
const cured = ref(false)
const shakingTool = ref<Tool | null>(null)
// 卡關保護：同一位病患的同一步錯 2 次就閃正解
const toolMisses = ref(0)
const diagnoseMisses = ref(0)
const { later, clearAll } = useTimeouts()

let completed = false

const patient = computed(() => rounds.current.value)
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: PATIENTS.length,
}))
const reportSource = computed(() => (lastTool.value === 'describe' ? 'Events（K8s 說的）' : 'logs（程式說的）'))

function inspect(tool: Tool) {
  if (status.value !== 'playing' || cured.value) return
  checks.value++
  if (checks.value > MAX_CHECKS) {
    playSfx('wrong')
    status.value = 'lost'
    return
  }
  playSfx('tap')
  lastTool.value = tool
  if (tool !== patient.value.tool) toolMisses.value++

  const notStarted = patient.value.id !== 'crash'
  if (notStarted && tool !== 'describe') {
    shakingTool.value = tool
    later(() => (shakingTool.value = null), 400)
    hint.show('容器沒起來就沒有 logs，先看 Events', 'bad')
  } else if (patient.value.id === 'crash' && tool === 'logs') {
    hint.show('這是剛重啟這輪，上一輪呢？', 'info')
  }
}

function diagnose(_id: string, correct: boolean) {
  if (status.value !== 'playing') return
  if (!correct) {
    diagnoseMisses.value++
    hint.show(patient.value.clue, 'bad')
    return
  }
  rounds.record(true)
  cured.value = true
  hint.show('診斷正確！下一位', 'good', 1200)
  later(nextPatient, 1400)
}

function resetPatient() {
  cured.value = false
  lastTool.value = null
  shakingTool.value = null
  toolMisses.value = 0
  diagnoseMisses.value = 0
}

function nextPatient() {
  if (status.value !== 'playing') return
  resetPatient()
  if (!rounds.next()) status.value = 'won'
}

function retry() {
  clearAll()
  rounds.reset()
  checks.value = 0
  resetPatient()
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
    hint="用對工具，找出泡泡病因"
    :status="status"
    :aha="AHA"
    :progress="progress"
    lose-text="檢查超過 7 次了。先 get 看狀態、再 describe 看 Events、最後才 logs。"
    @start="status = 'playing'"
    @retry="retry"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="ward">
      <KChar id="bubble" :size="72" :fx="cured ? 'bounce' : patient.fx" :badge="patient.restarts || undefined" disabled />
      <div class="ward__side">
        <small class="ward__cmd">$ kubectl get pods</small>
        <div class="getline" :data-patient="patient.id">
          <span>NAME</span><span>READY</span><span>STATUS</span><span>RESTARTS</span>
          <b>{{ patient.name }}</b><b>0/1</b><b class="getline__status">{{ patient.status }}</b><b>{{ patient.restarts }}</b>
        </div>
      </div>
    </div>

    <div class="report paper">
      <div class="report__head">
        <CharacterSprite id="magnifier" :size="28" />
        <span>檢查報告<template v-if="lastTool">：{{ reportSource }}</template></span>
        <small class="report__count" data-test="checks">檢查 {{ checks }}/{{ MAX_CHECKS }}</small>
      </div>
      <pre v-if="lastTool" class="report__out">{{ patient.output[lastTool].join('\n') }}</pre>
      <p v-else class="report__empty">先選一個工具檢查</p>
    </div>

    <div v-if="lastTool" class="diagnose" :data-flash="diagnoseMisses >= 2 ? patient.answer : undefined">
      <small>病因是？</small>
      <ChoiceCards :key="patient.id" :options="DIAGNOSES" :answer="patient.answer" @choose="diagnose" />
    </div>

    <template #controls>
      <div class="tools">
        <TagChip
          v-for="tool in TOOLS"
          :key="tool.id"
          :text="tool.label"
          mono
          color="blue"
          class="tools__btn"
          :class="{ shake: shakingTool === tool.id, 'is-flash': toolMisses >= 2 && tool.id === patient.tool }"
          :data-tool="tool.id"
          :disabled="cured"
          @tap="inspect(tool.id)"
        />
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.tools__btn.is-flash,
.diagnose[data-flash='image'] :deep([data-choice='image']),
.diagnose[data-flash='config'] :deep([data-choice='config']),
.diagnose[data-flash='node'] :deep([data-choice='node']) {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}

.ward {
  margin: 60px 10px 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ward__side {
  flex: 1;
  min-width: 0;
}

.ward__cmd {
  font-family: ui-monospace, Menlo, monospace;
  color: var(--ink-soft);
}

.getline {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  gap: 0 4px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.68rem;
}

.getline > * {
  white-space: nowrap;
}

.getline span {
  color: var(--ink-soft);
}

.getline__status {
  color: var(--danger);
}

.report {
  margin: 0 10px 8px;
  padding: 8px 10px;
}

.report__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}

.report__count {
  margin-left: auto;
  color: var(--ink-soft);
}

.report__out {
  margin: 6px 0 0;
  padding: 8px;
  min-height: 62px;
  border-radius: var(--radius-sm);
  background: #3d2f25;
  color: #f6efe2;
  font-size: 0.72rem;
  line-height: 1.4;
  white-space: pre-wrap;
}

.report__empty {
  margin: 6px 0 0;
  color: var(--ink-soft);
  font-size: 0.85rem;
}

.diagnose {
  margin: 0 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tools {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr;
  gap: 8px;
}

.tools__btn {
  min-height: 48px;
  padding: 4px 6px;
  white-space: nowrap;
}
</style>
