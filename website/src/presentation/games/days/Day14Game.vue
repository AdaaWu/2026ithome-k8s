<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { ChoiceCards, GameShell, HintBubble, KChar, TagChip, useHint, useTicker, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 14 名單偵探：修好 selector 讓名單出現，看泡泡換 IP 時柱子 IP 一個字都沒變
const emit = defineEmits<{ complete: [] }>()

interface Pod {
  key: number
  ip: string
  ready: boolean
  fx: CharFx
}

const CLUSTER_IP = '10.96.123.45'
const GOAL = 15
const SELECTOR_OPTIONS = [
  { id: 'Hello', label: 'app: Hello' },
  { id: 'hello', label: 'app: hello' },
  { id: 'name', label: 'name: hello-7d4b' },
]
const WRONG_WHY: Record<string, string> = {
  Hello: 'Label 大小寫要完全一樣',
  name: '泡泡身上沒有 name 這張貼紙',
}
const AHA = 'Pod IP 會換，Service 提供穩定入口。名單（Endpoints）由 selector 和 Ready 自動維護，打不通先查名單。'

const status = ref<GameStatus>('intro')
const hint = useHint()
const selector = ref('app: helo')
const fixed = ref(false)
const picking = ref(false)
const okCount = ref(0)
const failCount = ref(0)
const totemFx = ref<CharFx>('none')
const rolling = ref(false)
const rolled = ref(false)
const eventDone = ref(false)
const struck = ref<string[]>([])
const lastHit = ref<number | null>(null)
const lastFailed = ref(false)
const selectorMisses = ref(0)

let ipSeq = 5
let keySeq = 0
const newPod = (ready: boolean): Pod => ({ key: keySeq++, ip: `10.244.1.${ipSeq++}`, ready, fx: 'none' })
const pods = reactive<Pod[]>([])

let completed = false
let robin = 0
const { later, clearAll } = useTimeouts()

// 正在破掉的泡泡是終止中，不是啟動中
const stateOf = (pod: Pod) => (pod.ready ? 'Ready' : pod.fx === 'pop' ? '終止中' : '啟動中')

const endpoints = computed(() => (fixed.value ? pods.filter((p) => p.ready) : []))

function setFx(pod: Pod, fx: CharFx, resetMs?: number) {
  pod.fx = 'none'
  later(() => (pod.fx = fx), 20)
  if (resetMs) later(() => pod.fx === fx && (pod.fx = 'none'), resetMs)
}

const ticker = useTicker(1000, (tick) => {
  const list = endpoints.value
  lastHit.value = null
  lastFailed.value = list.length === 0
  if (list.length === 0) {
    failCount.value++
    totemFx.value = 'none'
    later(() => (totemFx.value = 'shake'), 20)
    if (tick === 3 && !fixed.value) hint.show('請求全失敗，點黃色的 app: helo 修名單', 'bad')
    return
  }
  okCount.value++
  const target = list[robin++ % list.length] as Pod
  lastHit.value = target.key
  setFx(target, 'glow', 500)
  checkWin()
})

function begin() {
  ipSeq = 5
  pods.splice(0, pods.length, newPod(true), newPod(true), newPod(false))
  status.value = 'playing'
  ticker.start()
}

function checkWin() {
  if (okCount.value < GOAL || !rolled.value) return
  ticker.stop()
  clearAll()
  playSfx('win')
  status.value = 'won'
}

function chooseSelector(id: string, correct: boolean) {
  selector.value = SELECTOR_OPTIONS.find((o) => o.id === id)?.label ?? selector.value
  if (status.value !== 'playing') return
  if (!correct) {
    selectorMisses.value++
    hint.show(WRONG_WHY[id] ?? '名單還是空的', 'bad')
    return
  }
  fixed.value = true
  hint.show('名單出現了！啟動中那顆先不收', 'good')
  later(() => (picking.value = false), 700)
  // 啟動中的泡泡 Ready 後自動進名單，接著一顆泡泡破掉換人
  later(() => {
    if (status.value !== 'playing') return
    const starting = pods.find((p) => !p.ready)
    if (starting) starting.ready = true
    hint.show('它 Ready 了，自動進名單', 'good')
  }, 3000)
  later(() => {
    if (status.value !== 'playing') return
    replacePod(0)
    hint.show('泡泡破了，名單自動換人', 'info')
  }, 5000)
  later(() => (eventDone.value = true), 6400)
}

function replacePod(index: number) {
  const old = pods[index]
  if (!old) return
  playSfx('pop')
  old.ready = false
  old.fx = 'pop'
  struck.value.push(old.ip)
  later(() => {
    const fresh = newPod(false)
    fresh.fx = 'bounce'
    pods[index] = fresh
    const live = pods[index] as Pod
    later(() => {
      live.ready = true
      struck.value = struck.value.filter((ip) => ip !== old.ip)
    }, 700)
  }, 600)
}

// 滾動更新：新泡泡先 Ready 進名單，舊的才退場（maxSurge 1、maxUnavailable 0）
function surgeReplace(index: number) {
  const fresh = newPod(false)
  pods.splice(index + 1, 0, fresh)
  const live = pods[index + 1] as Pod
  live.fx = 'bounce'
  later(() => (live.ready = true), 600)
  later(() => {
    const old = pods[index]
    if (!old) return
    playSfx('pop')
    old.ready = false
    old.fx = 'pop'
    struck.value.push(old.ip)
    later(() => {
      pods.splice(index, 1)
      struck.value = struck.value.filter((ip) => ip !== old.ip)
    }, 500)
  }, 1000)
}

function rollout() {
  if (status.value !== 'playing' || !fixed.value || !eventDone.value || rolling.value || rolled.value) return
  playSfx('tap')
  rolling.value = true
  hint.show('三顆依序換新，盯著柱子 IP', 'info', 3000)
  ;[0, 1, 2].forEach((i) => later(() => surgeReplace(i), i * 1600))
  later(() => {
    if (status.value !== 'playing') return
    rolling.value = false
    rolled.value = true
    hint.show(`IP 全換了，柱子還是 ${CLUSTER_IP}`, 'good')
    checkWin()
  }, 5000)
}

function inspect(pod?: Pod) {
  playSfx('tap')
  if (!fixed.value) hint.show('柱子找 helo，泡泡貼的是 hello，點黃色那張改', 'bad')
  else if (pod && !pod.ready) hint.show('還在啟動，不收進名單', 'info')
  else hint.show('貼紙對上又 Ready，在名單上', 'good')
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="修好柱子名單，讓流量通"
    :status="status"
    :aha="AHA"
    :progress="{ current: Math.min(okCount, GOAL), total: GOAL }"
    @start="begin"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="client">
      <KChar id="bubble" :size="44" label="frontend" disabled />
      <TagChip text="GET http://hello" mono color="blue" class="static-chip" disabled />
      <div class="client__score">
        <span class="score score--ok" data-test="ok-count">成功 {{ okCount }}</span>
        <span class="score score--fail" data-test="fail-count">失敗 {{ failCount }}</span>
      </div>
    </div>

    <div class="service">
      <KChar id="totem" :size="76" :fx="totemFx" disabled />
      <div class="service__info">
        <p class="service__ip mono" data-test="cluster-ip">hello {{ CLUSTER_IP }}</p>
        <div class="service__selector">
          <TagChip :text="selector" mono :color="fixed ? 'green' : 'yellow'" data-test="selector" @tap="picking = !fixed" />
          <KChar id="magnifier" :size="36" @tap="inspect()" />
        </div>
        <div class="endpoints">
          <small>Endpoints</small>
          <span v-if="!endpoints.length && !struck.length" class="endpoints__empty mono">&lt;none&gt;</span>
          <span v-for="p in endpoints" :key="p.key" class="endpoints__ip mono" data-test="endpoint">{{ p.ip }}</span>
          <span v-for="ip in struck" :key="ip" class="endpoints__ip mono is-strike">{{ ip }}</span>
        </div>
      </div>
    </div>

    <div class="lane">
      <p v-if="lastFailed" class="lane__fail">✗ 名單是空的，請求沒人接</p>
      <template v-else>
        <span v-for="p in pods" :key="p.key" class="lane__arrow" :class="{ 'is-hit': lastHit === p.key }">▼</span>
      </template>
    </div>

    <!-- 選單疊在舞台下半，手機第一屏就看得到 -->
    <div v-if="picking" class="picker paper" :data-flash="selectorMisses >= 2 ? 'hello' : undefined">
      <small>柱子的 selector 該寫什麼？</small>
      <ChoiceCards :options="SELECTOR_OPTIONS" answer="hello" :columns="1" @choose="chooseSelector" />
    </div>

    <div class="pods">
      <div v-for="(p, i) in pods" :key="p.key" class="pod">
        <small class="pod__state" :class="{ 'is-off': !p.ready }">{{ stateOf(p) }}</small>
        <KChar id="bubble" :size="58" :fx="p.fx" :data-pod="i" @tap="inspect(p)" />
        <span class="pod__ip mono">{{ p.ip }}</span>
        <small class="pod__label">app: hello</small>
      </div>
    </div>

    <template #controls>
      <button
        class="btn btn--primary rollout"
        data-test="rollout"
        :disabled="!fixed || !eventDone || rolling || rolled"
        @click="rollout"
      >
        {{ rolled ? '滾動更新完成' : '滾動更新' }}
      </button>
    </template>
  </GameShell>
</template>

<style scoped>
.mono {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
}

.client {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  margin-top: 54px;
}

.static-chip:disabled {
  opacity: 1;
}

.lane {
  margin-top: auto;
  min-height: 48px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  align-items: center;
  justify-items: center;
  padding: 0 6px;
}

.lane__arrow {
  font-size: 1.4rem;
  color: var(--ink-soft);
  opacity: 0.25;
  transition: opacity 0.2s, color 0.2s;
}

.lane__arrow.is-hit {
  color: var(--leaf-deep);
  opacity: 1;
  animation: pop-in 0.35s both;
}

.lane__fail {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--danger);
  font-weight: 700;
  animation: shake 0.4s;
}

.client__score {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.78rem;
  font-weight: 700;
}

.score--ok {
  color: var(--leaf-deep);
}

.score--fail {
  color: var(--danger);
}

.service {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 10px;
  padding: 8px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--cloud) 70%, transparent);
}

.service__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.service__ip {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
}

.service__selector {
  display: flex;
  align-items: center;
  gap: 4px;
}

.endpoints {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
}

.endpoints__ip,
.endpoints__empty {
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--leaf-deep);
  background: color-mix(in srgb, var(--leaf) 20%, var(--cloud));
}

.endpoints__empty {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 12%, var(--cloud));
}

.endpoints__ip.is-strike {
  text-decoration: line-through;
  opacity: 0.55;
}

.pods {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  padding: 0 6px 12px;
}

.pod {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pod__ip {
  font-size: 0.72rem;
}

.pod__label {
  font-size: 0.68rem;
  color: var(--ink-soft);
}

.pod__state {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--success);
}

.pod__state.is-off {
  color: var(--ink-soft);
}

.picker {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  z-index: 5;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.picker[data-flash='hello'] :deep([data-choice='hello']) {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}

.rollout {
  width: 100%;
  min-height: 52px;
}
</style>
