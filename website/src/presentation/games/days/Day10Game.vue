<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, Meter, TagChip, useHint, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 10 滾動換裝秀：玩家扮演 Deployment controller，加新、等就緒、再收舊
const emit = defineEmits<{ complete: [] }>()

interface NewPod {
  key: number
  ready: boolean
}

const REPLICAS = 3
const MAX_TOTAL = REPLICAS + 1 // maxSurge: 1
const MIN_READY = REPLICAS // maxUnavailable: 0
const READY_MS = 1500
const AHA = '一個版本一隻貓頭鷹（ReplicaSet）。部署管家（Deployment）先加新、等就緒、再收舊；舊貓頭鷹停在 0 不刪，後悔時就靠它。'
const LOSE_TEXT = '新的還沒 Ready，就先收舊的了。先加新、等 Ready，再收舊。'

const status = ref<GameStatus>('intro')
const oldCount = ref(REPLICAS)
const poppingOld = ref(false)
const newPods = ref<NewPod[]>([])
const shaking = ref<'add' | 'remove' | null>(null)
const misses = ref(0)
// 換裝完成到過關之間鎖住輸入
const locked = ref(false)
const hint = useHint()

let seq = 0
let completed = false
const { later, clearAll } = useTimeouts()

const readyCount = computed(() => oldCount.value + newPods.value.filter((p) => p.ready).length)
const total = computed(() => oldCount.value + newPods.value.length)
// 卡關保護：連錯 2 次就讓下一步該按的鈕閃；新泡泡還沒 Ready 時不閃，等它就緒
const suggest = computed<'add' | 'remove' | null>(() => {
  if (misses.value < 2) return null
  if (total.value < MAX_TOTAL) return 'add'
  return readyCount.value - 1 >= MIN_READY ? 'remove' : null
})

function begin() {
  clearAll()
  hint.clear()
  oldCount.value = REPLICAS
  poppingOld.value = false
  newPods.value = []
  shaking.value = null
  misses.value = 0
  locked.value = false
  status.value = 'playing'
}

function reject(button: 'add' | 'remove', text: string) {
  misses.value++
  playSfx('wrong')
  shaking.value = button
  later(() => (shaking.value = null), 400)
  hint.show(text, 'bad')
}

function addNew() {
  if (status.value !== 'playing' || locked.value) return
  if (newPods.value.length >= REPLICAS) return reject('add', 'v2 泡泡已經滿 3 顆了')
  if (total.value >= MAX_TOTAL) return reject('add', 'maxSurge 1：最多只能多一顆')
  const pod: NewPod = { key: ++seq, ready: false }
  newPods.value.push(pod)
  playSfx('tap')
  later(() => {
    if (status.value !== 'playing') return
    const target = newPods.value.find((p) => p.key === pod.key)
    if (!target) return
    target.ready = true
    playSfx('correct')
    hint.show('新泡泡 Ready，可以接客了', 'good')
  }, READY_MS)
}

function removeOld() {
  if (status.value !== 'playing' || locked.value) return
  if (oldCount.value === 0) return reject('remove', '舊的已經收完了')
  if (readyCount.value - 1 < MIN_READY) {
    oldCount.value--
    playSfx('wrong')
    status.value = 'lost'
    return
  }
  misses.value = 0
  oldCount.value--
  poppingOld.value = true
  playSfx('pop')
  later(() => (poppingOld.value = false), 350)
  if (oldCount.value === 0 && newPods.value.length === REPLICAS && newPods.value.every((p) => p.ready)) {
    locked.value = true
    hint.show('舊貓頭鷹停在 0，沒被刪', 'good', 3000)
    later(() => {
      if (status.value === 'playing') status.value = 'won'
    }, 1200)
  }
}

// 剛收掉的那顆留著播 pop 動畫
const isPopping = (index: number) => poppingOld.value && index === oldCount.value
function oldFx(index: number): CharFx {
  if (index < oldCount.value) return 'none'
  return isPopping(index) ? 'pop' : 'gone'
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="加新減舊，可用數不能掉"
    :status="status"
    :aha="AHA"
    :lose-text="LOSE_TEXT"
    @start="begin"
    @retry="begin"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="steward">
      <KChar id="steward" :size="56" disabled />
      <div class="steward__chips">
        <TagChip text="maxSurge: 1" mono color="yellow" />
        <TagChip text="maxUnavailable: 0" mono color="red" />
      </div>
    </div>

    <div class="sides">
      <section class="side">
        <KChar id="owl" :size="52" :badge="oldCount" :fx="oldCount === 0 ? 'dim' : 'none'" label="v1 貓頭鷹" disabled data-test="old-owl" />
        <div v-for="i in REPLICAS" :key="i" class="pod" :class="{ 'is-gone': i - 1 >= oldCount && !isPopping(i - 1) }">
          <KChar id="bubble" :size="44" :fx="oldFx(i - 1)" label="v1" disabled data-pod="v1" />
          <span v-if="i - 1 < oldCount" class="pod__state is-ready">Ready</span>
        </div>
      </section>
      <section class="side">
        <KChar id="owl" :size="52" :badge="newPods.length" label="v2 貓頭鷹" disabled />
        <div v-for="p in newPods" :key="p.key" class="pod">
          <KChar id="bubble" :size="44" :fx="p.ready ? 'bounce' : 'dim'" label="v2" disabled data-pod="v2" />
          <span class="pod__state" :class="{ 'is-ready': p.ready }">{{ p.ready ? 'Ready' : '啟動中' }}</span>
        </div>
      </section>
    </div>

    <div class="meters">
      <Meter label="可接客（Ready）" :value="readyCount" :max="MAX_TOTAL" :marks="[{ at: MIN_READY, label: `至少 ${MIN_READY}`, color: 'red' }]" />
      <Meter :label="`泡泡總數（上限 ${MAX_TOTAL}）`" :value="total" :max="MAX_TOTAL" />
    </div>

    <template #controls>
      <div class="actions">
        <button
          class="btn actions__btn"
          :class="{ shake: shaking === 'add', 'is-flash': suggest === 'add' }"
          data-test="add-new"
          @click="addNew"
        >加一顆 v2</button>
        <button
          class="btn actions__btn"
          :class="{ shake: shaking === 'remove', 'is-flash': suggest === 'remove' }"
          data-test="remove-old"
          @click="removeOld"
        >收一顆 v1</button>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.steward {
  margin: 56px 12px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.steward__chips {
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.sides {
  margin: 8px 12px 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.side {
  min-height: 230px;
  padding: 6px 4px;
  border: 2px dashed var(--ink-soft);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.pod {
  display: flex;
  align-items: center;
}

.pod.is-gone {
  visibility: hidden;
}

.pod__state {
  width: 42px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ink-soft);
}

.pod__state.is-ready {
  color: var(--leaf-deep);
}

.meters {
  margin: auto 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.actions {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.actions__btn {
  min-height: 56px;
}

.actions__btn.is-flash {
  animation: day10-flash 0.8s ease-in-out infinite;
}

@keyframes day10-flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}
</style>
