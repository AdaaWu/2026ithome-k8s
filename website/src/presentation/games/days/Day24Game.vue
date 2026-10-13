<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, Meter, TagChip, useCountdown, useHint, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 24 鈴與旗：玩家當管家松鼠，對發病的泡泡決定降旗、搖鈴重啟或等它開機
const emit = defineEmits<{ complete: [] }>()

type Action = 'flag' | 'bell' | 'wait'
type Kind = 'slow' | 'db' | 'deadlock' | 'boot'
type PodState = 'ok' | 'sick' | 'resting' | 'restarting' | 'dead'

interface Pod {
  name: string
  ready: boolean
  restarts: number
  state: PodState
}

const SYMPTOMS: Record<Kind, { text: string; right: Action }> = {
  slow: { text: '回應變慢（GC 中）', right: 'flag' },
  db: { text: '這顆連線池滿了', right: 'flag' },
  deadlock: { text: '死結：程序在，但不回應', right: 'bell' },
  boot: { text: '開機中：載入模型', right: 'wait' },
}
const ORDER: Kind[] = ['boot', 'slow', 'deadlock', 'db', 'slow', 'boot', 'deadlock', 'db']
const ACTIONS: Array<{ id: Action; label: string }> = [
  { id: 'flag', label: '降旗' },
  { id: 'bell', label: '搖鈴重啟' },
  { id: 'wait', label: '等它開機' },
]
const ACTION_LABEL = Object.fromEntries(ACTIONS.map((a) => [a.id, a.label])) as Record<Action, string>
const GOAL = 8
const MAX_MISS = 3
const PATIENCE_SEC = 5
const RECOVER_MS = 3000
const AHA = '管家松鼠（kubelet）用 Readiness 管流量、Liveness 管重啟、Startup 給慢開機緩衝。只是慢就降旗別搖鈴，資料庫檢查別放 Liveness。'

const status = ref<GameStatus>('intro')
const hint = useHint(2600)
const pods = reactive<Pod[]>([])
const current = ref<{ pod: number; kind: Kind; botched: boolean } | null>(null)
const solved = ref(0)
const misses = ref(0)
const bellFx = ref<Record<number, CharFx>>({})
const missStreak = ref(0)

let completed = false
let seq = 0
let robin = 0
const { later: schedule, clearAll: clearLater } = useTimeouts()
// 延遲回呼只在本局進行中才生效
const later = (fn: () => void, ms: number) =>
  schedule(() => {
    if (status.value === 'playing') fn()
  }, ms)
// 卡關保護：連續失誤 2 次，閃目前症狀的正解
const flashAction = computed(() => (missStreak.value >= 2 && current.value ? SYMPTOMS[current.value.kind].right : null))

const patience = useCountdown(PATIENCE_SEC, { onExpire: expire })
const timer = computed(() => (current.value ? { remaining: patience.remaining.value, total: PATIENCE_SEC } : undefined))

function reset() {
  clearLater()
  patience.reset()
  hint.clear()
  pods.splice(0, pods.length, ...['web-a', 'web-b', 'web-c'].map((name) => ({ name, ready: true, restarts: 0, state: 'ok' as PodState })))
  current.value = null
  solved.value = 0
  misses.value = 0
  missStreak.value = 0
  bellFx.value = {}
  seq = 0
  robin = 0
  status.value = 'playing'
  later(() => spawn(), 1000)
}

// 同一時間只讓一顆健康的泡泡發病
function spawn(force?: Kind, avoid?: number) {
  if (status.value !== 'playing') return
  const healthy = pods.map((p, i) => ({ p, i })).filter(({ p, i }) => p.state === 'ok' && i !== avoid)
  if (!healthy.length) return later(() => spawn(force), 1000)
  const target = healthy[robin++ % healthy.length]!
  const kind = force ?? ORDER[seq++ % ORDER.length]!
  target.p.state = 'sick'
  if (kind === 'boot') target.p.ready = false
  current.value = { pod: target.i, kind, botched: false }
  patience.reset()
  patience.start()
  playSfx('pop')
}

function settle(index: number, ms: number, then: () => void = () => {}) {
  later(() => {
    const pod = pods[index]
    if (pod && pod.state !== 'dead') {
      pod.state = 'ok'
      pod.ready = true
    }
    then()
  }, ms)
}

function restart(index: number) {
  const pod = pods[index] as Pod
  pod.restarts++
  pod.ready = false
  pod.state = 'restarting'
  bellFx.value = { ...bellFx.value, [index]: 'shake' }
  later(() => (bellFx.value = { ...bellFx.value, [index]: 'none' }), 500)
}

function closeSymptom(next: number, force?: Kind, avoid?: number) {
  current.value = null
  patience.pause()
  if (misses.value >= MAX_MISS) {
    status.value = 'lost'
    clearLater()
    return
  }
  if (solved.value >= GOAL) {
    later(() => {
      playSfx('win')
      status.value = 'won'
    }, 800)
    return
  }
  later(() => spawn(force, avoid), next)
}

function act(action: Action) {
  const c = current.value
  if (!c || c.botched || status.value !== 'playing') return
  const pod = pods[c.pod] as Pod
  const right = SYMPTOMS[c.kind].right

  if (action === right) {
    playSfx('correct')
    solved.value++
    missStreak.value = 0
    if (action === 'flag') {
      pod.ready = false
      pod.state = 'resting'
      hint.show('降旗：柱子跳過它，不重啟', 'good')
    } else if (action === 'bell') {
      restart(c.pod)
      hint.show('搖鈴重啟，死結解開了', 'good')
    } else {
      pod.state = 'resting'
      hint.show('開機完成才升旗接客', 'good')
    }
    settle(c.pod, RECOVER_MS)
    return closeSymptom(1500)
  }

  playSfx('wrong')
  missStreak.value++
  if ((c.kind === 'slow' || c.kind === 'db') && action === 'bell') {
    misses.value++
    restart(c.pod)
    settle(c.pod, RECOVER_MS)
    hint.show(c.kind === 'db' ? '連線池滿重啟也沒用，降旗讓它喘口氣' : '只是慢就重啟，流量壓垮別顆', 'bad')
    return closeSymptom(1200, 'slow', c.pod)
  }
  if (c.kind === 'deadlock' && action === 'flag') {
    misses.value++
    pod.ready = false
    pod.state = 'dead'
    hint.show('降旗不會重啟，死結解不開', 'bad')
    return closeSymptom(1500)
  }
  if (c.kind === 'boot' && action === 'bell') {
    misses.value++
    restart(c.pod)
    settle(c.pod, RECOVER_MS)
    hint.show('又從頭開機，這就是 Startup 的用途', 'bad')
    return closeSymptom(1500)
  }
  // 規格沒定義的組合：症狀持續到逾時，算一次失誤
  c.botched = true
  hint.show(`沒用！正解是「${ACTION_LABEL[right]}」`, 'bad', 4000)
}

function expire() {
  const c = current.value
  if (!c) return
  misses.value++
  if (!c.botched) missStreak.value++
  playSfx('wrong')
  if (!c.botched) hint.show(`逾時！正解是「${ACTION_LABEL[SYMPTOMS[c.kind].right]}」`, 'bad')
  settle(c.pod, 0)
  closeSymptom(1500)
}

function podFx(pod: Pod): CharFx {
  if (pod.state === 'restarting') return 'shake'
  if (pod.state === 'dead') return 'red'
  if (pod.state === 'sick') return current.value?.kind === 'slow' ? 'slow' : 'red'
  return 'none'
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="判斷該降旗、搖鈴，還是等它開機"
    :status="status"
    :aha="AHA"
    :timer="timer"
    :progress="{ current: solved, total: GOAL }"
    lose-text="失誤 3 次。記住：Liveness 決定生死，Readiness 決定流量，Startup 決定何時開始問"
    @start="reset"
    @retry="reset"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="top">
      <KChar id="totem" :size="56" label="柱子" disabled />
      <p class="top__text">
        流量只送給<b>升旗</b>的泡泡
        <small class="top__timer" data-test="timer-note">上方細條：{{ PATIENCE_SEC }} 秒內要處置</small>
      </p>
      <KChar id="squirrel" :size="52" label="你" disabled />
    </div>

    <div class="pods">
      <div v-for="(pod, i) in pods" :key="pod.name" class="pod">
        <div class="pod__slot">
          <TagChip
            v-if="current?.pod === i"
            :text="SYMPTOMS[current.kind].text"
            color="yellow"
            class="pod__symptom"
            data-test="symptom"
            disabled
          />
          <small v-else-if="pod.state === 'dead'" class="pod__dead">卡死，沒人救</small>
        </div>
        <span class="pod__traffic" :class="{ 'is-off': !pod.ready }">{{ pod.ready ? '● ● ●' : '— 不接客 —' }}</span>
        <KChar id="ready-flag" :size="30" :fx="pod.ready ? 'none' : 'dim'" disabled />
        <div class="pod__body">
          <KChar id="bubble" :size="76" :badge="pod.restarts" :fx="podFx(pod)" :label="pod.name" disabled />
          <KChar id="alive-bell" :size="26" :fx="bellFx[i] ?? 'none'" class="pod__bell" disabled />
        </div>
      </div>
    </div>

    <div class="meter">
      <Meter :value="misses" :max="MAX_MISS" label="失誤" />
    </div>

    <template #controls>
      <div class="actions">
        <button
          v-for="a in ACTIONS"
          :key="a.id"
          class="btn actions__btn"
          :class="{ 'is-flash': flashAction === a.id }"
          :data-action="a.id"
          :disabled="!current || current.botched"
          @click="act(a.id)"
        >
          {{ a.label }}
        </button>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 56px 12px 0;
}

.top__text {
  margin: 0;
  font-size: 0.85rem;
  text-align: center;
}

.top__timer {
  display: block;
  font-size: 0.72rem;
  color: var(--ink-soft);
}

.pods {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 10px 6px 0;
}

.pod {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.pod__slot {
  min-height: 64px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  text-align: center;
}

.pod__traffic {
  font-size: 0.7rem;
  color: var(--leaf-deep);
  letter-spacing: 2px;
}

.pod__traffic.is-off {
  color: var(--ink-soft);
  letter-spacing: 0;
}

.pod__body {
  position: relative;
}

.pod__bell {
  position: absolute;
  right: -14px;
  top: 6px;
}

.pod__symptom {
  font-size: 0.72rem;
  padding: 3px 6px;
  animation: pop-in 0.35s both;
}

.pod__symptom:disabled {
  opacity: 1;
}

.pod__dead {
  color: var(--danger);
  font-size: 0.72rem;
}

.meter {
  margin: auto 16px 12px;
}

.actions {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.actions__btn {
  min-height: 56px;
  padding: 0 4px;
}

.actions__btn.is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}
</style>
