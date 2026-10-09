<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { ChoiceCards, GameShell, HintBubble, KChar, useHint, useRounds, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 27 編號點名：玩家扮演 StatefulSet 控制器，依序建立、同名重建接回專屬倉庫、縮容從最大編號走
const emit = defineEmits<{ complete: [] }>()

type PodState = 'ghost' | 'pending' | 'ready' | 'pop'
type Segment = 'create' | 'recreate' | 'dns' | 'scale'

const SEGMENTS: Segment[] = ['create', 'recreate', 'dns', 'scale']
const TASK: Record<Segment, string> = {
  create: '依序建立 hello-db-0、1、2',
  recreate: 'hello-db-1 被刪了，把它找回來',
  dns: '要連主節點 0 號，填哪個地址？',
  scale: '縮成 2 顆，誰先走？',
}
const ADDRESS = [
  { id: 'svc', label: 'hello-db' },
  { id: 'pod-dns', label: 'hello-db-0.hello-db' },
  { id: 'ip', label: '10.244.1.9' },
]
const ADDRESS_WHY: Record<string, string> = {
  svc: 'Headless 沒虛擬 IP，會回傳全部 Pod',
  ip: 'Pod 重建後 IP 會換',
}
const READY_MS = 1500
const SLOTS = [0, 1, 2]
const AHA = '號碼牌配專屬倉庫（PV），這才是 StatefulSet。刪掉 1 號，回來的還是 1 號，接回的還是它自己那座倉庫。'

const status = ref<GameStatus>('intro')
const rounds = useRounds(SEGMENTS)
const hint = useHint(2600)
const pods = ref<PodState[]>(['ghost', 'ghost', 'ghost'])
const linked = ref([false, false, false])
const waitingWarehouse = ref(false)
const shakeKey = ref<string | null>(null)
const stepMisses = ref(0)

const { later: schedule } = useTimeouts()
// 延遲回呼只在本局進行中才生效
const later = (fn: () => void, ms: number) =>
  schedule(() => {
    if (status.value === 'playing') fn()
  }, ms)
let completed = false

const segment = computed(() => rounds.current.value)
// 卡關保護：同一步連錯 2 次，閃這一步的正確目標
const flashKey = computed(() => {
  if (stepMisses.value < 2) return null
  if (segment.value === 'create') return `pod-${pods.value.indexOf('ghost')}`
  if (segment.value === 'recreate') return waitingWarehouse.value ? 'wh-1' : 'pod-1'
  if (segment.value === 'dns') return 'pod-dns'
  return 'pod-2'
})
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: SEGMENTS.length,
}))

function podFx(i: number): CharFx {
  if (shakeKey.value === `pod-${i}`) return 'shake'
  return { ghost: 'ghost', pending: 'bounce', ready: 'none', pop: 'pop' }[pods.value[i]!] as CharFx
}

function wrong(key: string, text: string) {
  playSfx('wrong')
  stepMisses.value++
  shakeKey.value = key
  later(() => (shakeKey.value = null), 400)
  hint.show(text, 'bad')
}

function nextSegment(delay: number) {
  rounds.record(true)
  stepMisses.value = 0
  later(() => {
    rounds.next()
    if (segment.value === 'recreate') {
      pods.value[1] = 'pop'
      playSfx('pop')
      later(() => (pods.value[1] = 'ghost'), 400)
      hint.show('1 號被刪了，點它重建', 'info')
    }
  }, delay)
}

// 建立後 1.5 秒升旗，同時接上同編號的倉庫
function create(i: number, onReady: () => void) {
  pods.value[i] = 'pending'
  playSfx('tap')
  later(() => {
    pods.value[i] = 'ready'
    linked.value[i] = true
    playSfx('correct')
    onReady()
  }, READY_MS)
}

function tapPod(i: number) {
  if (status.value !== 'playing') return
  const state = pods.value[i]
  if (segment.value === 'create') {
    if (state !== 'ghost') return
    const nextIndex = pods.value.indexOf('ghost')
    if (i !== nextIndex) return wrong(`pod-${i}`, 'OrderedReady：照 0→1→2 建')
    if (i > 0 && pods.value[i - 1] !== 'ready') return wrong(`pod-${i}`, 'OrderedReady：前一顆 Ready 才建下一顆')
    stepMisses.value = 0
    create(i, () => {
      if (pods.value.every((p) => p === 'ready')) {
        hint.show('三顆都就緒，名字固定', 'good')
        nextSegment(1200)
      }
    })
    return
  }
  if (segment.value === 'recreate' && i === 1 && state === 'ghost' && !waitingWarehouse.value) {
    pods.value[1] = 'pending'
    linked.value[1] = false
    waitingWarehouse.value = true
    stepMisses.value = 0
    playSfx('tap')
    hint.show('同名回來了！它要接哪座倉庫？', 'info', 4000)
    return
  }
  if (segment.value === 'recreate' && !waitingWarehouse.value && i !== 1) return wrong(`pod-${i}`, '被刪的是 1 號，點它的空位')
  if (segment.value === 'scale' && state === 'ready') {
    if (i !== 2) return wrong(`pod-${i}`, '縮容從最大編號開始')
    pods.value[2] = 'pop'
    playSfx('pop')
    rounds.record(true)
    hint.show('2 號走了，它的倉庫還留著', 'good', 3000)
    later(() => (status.value = 'won'), 1800)
  }
}

function tapWarehouse(i: number) {
  if (status.value !== 'playing' || !waitingWarehouse.value) return
  if (i !== 1) return wrong(`wh-${i}`, '每個編號只接自己那座')
  waitingWarehouse.value = false
  create(1, () => {
    hint.show('接回原本的倉庫，資料原封不動', 'good')
    nextSegment(1000)
  })
}

function chooseAddress(id: string, correct: boolean) {
  if (status.value !== 'playing') return
  if (!correct) {
    stepMisses.value++
    return hint.show(ADDRESS_WHY[id] ?? '', 'bad')
  }
  hint.show('帶編號的 DNS 永遠指到 0 號', 'good')
  nextSegment(1000)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="照順序建泡泡，接回專屬倉庫"
    :status="status"
    :aha="AHA"
    :progress="progress"
    @start="status = 'playing'"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="keeper">
      <KChar :id="segment === 'dns' ? 'totem' : 'numbered-keeper'" :size="60" disabled />
      <p class="keeper__task">{{ TASK[segment] }}</p>
    </div>

    <div class="lanes">
      <div v-for="i in SLOTS" :key="i" class="lane">
        <div class="lane__pod">
          <KChar
            id="bubble"
            :size="64"
            :fx="podFx(i)"
            :label="`hello-db-${i}`"
            :data-slot="i"
            :class="{ 'is-flash': flashKey === `pod-${i}` }"
            @tap="tapPod(i)"
          />
          <KChar
            id="ready-flag"
            :size="24"
            :fx="pods[i] === 'ready' ? 'bounce' : pods[i] === 'pending' ? 'dim' : 'gone'"
            disabled
            class="lane__flag"
          />
        </div>
        <span class="lane__link" :class="{ 'is-on': linked[i] && pods[i] !== 'ghost' && pods[i] !== 'pop' }" />
        <KChar
          id="warehouse"
          :size="56"
          :fx="shakeKey === `wh-${i}` ? 'shake' : linked[i] ? 'glow' : 'none'"
          :label="`data-hello-db-${i}`"
          :data-warehouse="i"
          :disabled="!waitingWarehouse"
          :class="{ 'is-pick': waitingWarehouse, 'is-flash': flashKey === `wh-${i}` }"
          @tap="tapWarehouse(i)"
        />
      </div>
    </div>

    <template #controls>
      <ChoiceCards v-if="segment === 'dns'" :options="ADDRESS" answer="pod-dns" class="address" :class="{ 'is-stuck': flashKey === 'pod-dns' }" @choose="chooseAddress" />
      <p v-else class="note">{{ waitingWarehouse ? '點它專屬的那座倉庫' : '點上面的泡泡位置' }}</p>
    </template>
  </GameShell>
</template>

<style scoped>
.keeper {
  margin: 56px 12px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.keeper__task {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
}

.lanes {
  margin: 16px 6px 12px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.lane {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lane__pod {
  position: relative;
}

.lane__flag {
  position: absolute;
  top: -6px;
  right: -14px;
}

.lane__link {
  width: 0;
  height: 44px;
  border-left: 4px dashed var(--ink-soft);
  opacity: 0.25;
  transition: opacity 0.3s, border-color 0.3s;
}

.lane__link.is-on {
  opacity: 1;
  border-left-style: solid;
  border-color: var(--leaf-deep);
}

.is-pick :deep(.kchar__body) {
  animation: bob 1.4s ease-in-out infinite;
}

.address {
  width: 100%;
}

.is-flash,
.address.is-stuck :deep([data-choice='pod-dns']) {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}

.address :deep(.choice__label) {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
}

.note {
  margin: 0;
  min-height: 48px;
  display: grid;
  place-items: center;
  color: var(--ink-soft);
}
</style>
