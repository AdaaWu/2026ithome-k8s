<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, useTicker, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 9 戳不完的泡泡：貓頭鷹（ReplicaSet）只比對數字，想減少泡泡要改期望數量
const emit = defineEmits<{ complete: [] }>()

interface Bubble {
  key: number
  name: string
  app: 'hello' | 'api'
  handmade?: boolean
  fx: CharFx
}

const START_REPLICAS = 3
const TICK_MS = 200
const WIN_HOLD_TICKS = 15
const AHA = '貓頭鷹（ReplicaSet）只數數字，不認得哪顆是哪顆。戳破的它會補回來；想讓泡泡變少，要改的是期望數量 replicas。'

const status = ref<GameStatus>('intro')
const replicas = ref(START_REPLICAS)
const bubbles = ref<Bubble[]>([])
const touchedReplicas = ref(false)
const flashMinus = ref(false)
const hint = useHint()

let seq = 0
let zeroTicks = 0
let pokes = 0
let completed = false
const { later, clearAll } = useTimeouts()

const randomName = () => `hello-${Math.random().toString(36).slice(2, 7)}`
// 被數到的泡泡：貼 app: hello 且還沒破
const counted = computed(() => bubbles.value.filter((b) => b.app === 'hello' && b.fx !== 'pop'))

function spawn(app: Bubble['app'], name = randomName(), handmade = false) {
  bubbles.value.push({ key: ++seq, name, app, handmade, fx: 'bounce' })
}

function burst(bubble: Bubble) {
  bubble.fx = 'pop'
  later(() => {
    if (status.value === 'playing') bubbles.value = bubbles.value.filter((b) => b.key !== bubble.key)
  }, 350)
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

// 期望與實際不同就動手：少了吹、多了隨機戳，回傳戳掉的泡泡
function reconcile(): Bubble[] {
  const diff = replicas.value - counted.value.length
  for (let i = 0; i < diff; i++) spawn('hello')
  const victims = shuffle(counted.value).slice(0, Math.max(0, -diff))
  victims.forEach(burst)
  if (diff > 0) playSfx('tap')
  if (victims.length) playSfx('pop')
  return victims
}

const ticker = useTicker(TICK_MS, (tick) => {
  const sec = (tick * TICK_MS) / 1000
  if (sec === 8 && !touchedReplicas.value) {
    hint.show('戳不贏的。試試貓頭鷹的數字？', 'info', 3500)
    flashMinus.value = true
  }
  if (sec === 10) {
    spawn('hello', 'my-bubble', true)
    later(() => {
      if (status.value !== 'playing') return
      const victims = reconcile()
      if (victims.length) hint.show('同一張貼紙就會被算進去', 'bad', 3000)
      else hint.show('手吹的泡泡被貓頭鷹收編了', 'info', 3000)
    }, 700)
  }
  if (sec === 15) spawn('api', 'api-7f3k')

  zeroTicks = counted.value.length === 0 ? zeroTicks + 1 : 0
  if (zeroTicks >= WIN_HOLD_TICKS) {
    ticker.stop()
    status.value = 'won'
  }
})

function begin() {
  clearAll()
  hint.clear()
  replicas.value = START_REPLICAS
  bubbles.value = []
  touchedReplicas.value = false
  flashMinus.value = false
  pokes = 0
  zeroTicks = 0
  for (let i = 0; i < START_REPLICAS; i++) spawn('hello')
  status.value = 'playing'
  ticker.start()
}

function tapBubble(bubble: Bubble) {
  if (status.value !== 'playing' || bubble.fx === 'pop') return
  playSfx('pop')
  burst(bubble)
  if (bubble.app === 'api') {
    hint.show('它貼 app: api，貓頭鷹不數它', 'info')
    return
  }
  // 卡關保護：連戳 2 顆還沒動數字，就閃減號
  if (++pokes >= 2 && !touchedReplicas.value) flashMinus.value = true
  later(() => {
    if (status.value !== 'playing') return
    if (reconcile().length === 0 && replicas.value > 0) hint.show('少一顆？貓頭鷹馬上補', 'bad')
  }, 800)
}

function changeReplicas(delta: number) {
  if (status.value !== 'playing') return
  const next = replicas.value + delta
  if (next < 0 || next > 5) return
  touchedReplicas.value = true
  flashMinus.value = false
  replicas.value = next
  reconcile()
  if (next === 0) hint.show('期望 0：撐 3 秒就過關', 'good', 3000)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="讓 app: hello 泡泡歸零"
    :status="status"
    :aha="AHA"
    @start="begin"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="owl-bar">
      <KChar id="owl" :size="84" :badge="`replicas: ${replicas}`" disabled class="owl-bar__owl" />
      <div class="owl-bar__count">
        <small>貓頭鷹數到</small>
        <b data-test="counted">{{ counted.length }}</b>
        <small>顆 app: hello</small>
      </div>
    </div>

    <div class="branch">
      <div v-for="b in bubbles" :key="b.key" class="branch__pod">
        <KChar
          id="bubble"
          :size="64"
          :fx="b.fx"
          :label="b.handmade ? '你手吹的' : b.name"
          :data-app="b.app"
          @tap="tapBubble(b)"
        />
        <TagChip :text="`app: ${b.app}`" :color="b.app === 'hello' ? 'red' : 'blue'" class="branch__chip" />
      </div>
    </div>

    <template #controls>
      <div class="knobs">
        <button
          class="btn knobs__btn"
          :class="{ 'is-flash': flashMinus }"
          data-test="minus"
          :disabled="replicas === 0"
          @click="changeReplicas(-1)"
        >− 期望數量</button>
        <button class="btn knobs__btn" data-test="plus" :disabled="replicas === 5" @click="changeReplicas(1)">＋ 期望數量</button>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.owl-bar {
  margin: 60px 12px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 52px;
}

.owl-bar__owl :deep(.kchar__badge) {
  right: -36px;
  white-space: nowrap;
}

.owl-bar__count {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--font-display);
}

.owl-bar__count b {
  font-size: 2rem;
  line-height: 1;
}

.branch {
  margin: 20px 8px 12px;
  padding-top: 12px;
  border-top: 6px solid #a57a4f;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 6px;
}

.branch__pod {
  width: 104px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

/* 貼紙只是顯示，不搶點擊 */
.branch__chip {
  pointer-events: none;
  font-size: 0.72rem;
}

.knobs {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.knobs__btn {
  min-height: 56px;
}

.knobs__btn.is-flash {
  animation: day09-flash 0.8s ease-in-out infinite;
}

@keyframes day09-flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}
</style>
