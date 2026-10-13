<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, usePickPlace, useRounds, useTimeouts, type GameStatus } from '../kit'

// Day 6 泡泡室友配對：判斷兩隻小鳥要不要住同一顆泡泡
const emit = defineEmits<{ complete: [] }>()

type BirdKey = '0' | '1'
type BubbleKey = 'A' | 'B'

interface Round {
  birds: [string, string]
  together: boolean
  // 放錯時的原因；兩個 :80 擠同一顆另外處理
  why: string
  clash?: boolean
  // 過關說明；沒寫就用門牌的通用說法
  ok?: string
}

const ROUNDS: Round[] = [
  {
    birds: ['Nginx :80', '日誌收集器（讀日誌檔）'],
    together: true,
    why: '小鳥預設不共用檔案，要同顆泡泡共掛共享食物桶（Volume）才讀得到日誌檔',
    ok: '掛同一個共享食物桶（Volume），收集器才讀得到 Nginx 的日誌檔',
  },
  { birds: ['網站 :80', 'Postgres :5432'], together: false, why: '網站更新時，資料庫不該一起死' },
  { birds: ['Nginx :80', 'Nginx :80'], together: false, why: '共用網路，80 埠撞號，第二隻綁不到', clash: true },
  { birds: ['App :8080', '本機代理 :15001'], together: true, why: '拆開後代理打 localhost 找不到 App' },
]

const AHA = '同一顆泡泡（Pod）的小鳥（Container）共用一塊門牌（IP）。要一起生、一起死、一起搬家的才放同一顆，這就是 sidecar。'

const status = ref<GameStatus>('intro')
const rounds = useRounds(ROUNDS)
const hint = useHint(2600)
const slots = reactive<Record<BirdKey, BubbleKey | null>>({ '0': null, '1': null })
const pp = usePickPlace<BirdKey, BubbleKey>()
const result = ref<'idle' | 'ok' | 'bad'>('idle')
const missCount = ref(0)

let completed = false
const { later } = useTimeouts()

const round = computed(() => rounds.current.value)
const together = computed(() => slots['0'] !== null && slots['0'] === slots['1'])
const ready = computed(() => slots['0'] !== null && slots['1'] !== null && result.value === 'idle')
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: ROUNDS.length,
}))

// 卡關保護：連錯 2 次後，一步一步閃出下一個該點的東西
const flashTarget = computed(() => {
  if (missCount.value < 2 || result.value !== 'idle') return null
  const picked = pp.picked.value
  if (picked === null) {
    const next = (['0', '1'] as BirdKey[]).find((b) => slots[b] === null)
    if (next) return `bird-${next}`
    return together.value === round.value.together ? 'blow' : 'placed-1'
  }
  const otherSlot = slots[picked === '0' ? '1' : '0']
  if (otherSlot === null || round.value.together) return `bubble-${otherSlot ?? 'A'}`
  return otherSlot === 'A' ? 'bubble-B' : 'bubble-A'
})

const birdsIn = (bubble: BubbleKey) => (['0', '1'] as BirdKey[]).filter((b) => slots[b] === bubble)
const used = (bubble: BubbleKey) => birdsIn(bubble).length > 0

// 成功後才掛門牌：同住共用一塊，分開各自一塊
function ipOf(bubble: BubbleKey) {
  if (result.value !== 'ok' || !used(bubble)) return null
  return bubble === 'A' ? '10.244.0.12' : '10.244.1.7'
}

function pickBird(bird: BirdKey) {
  if (status.value !== 'playing' || result.value !== 'idle') return
  if (slots[bird] !== null) {
    slots[bird] = null
    playSfx('tap')
    return
  }
  pp.pick(bird)
  playSfx('tap')
}

function tapBubble(bubble: BubbleKey) {
  if (status.value !== 'playing' || result.value !== 'idle') return
  const placed = pp.place(bubble)
  if (!placed.ok) return hint.show('先點一隻小鳥', 'info')
  slots[placed.item] = bubble
  playSfx('pop')
}

// 已放入的小鳥：手上沒小鳥時點它取回，有的話視同點泡泡
function tapPlaced(bubble: BubbleKey, bird: BirdKey) {
  if (pp.picked.value) tapBubble(bubble)
  else pickBird(bird)
}

function blow() {
  if (status.value !== 'playing' || !ready.value) return
  if (together.value === round.value.together) {
    result.value = 'ok'
    rounds.record(missCount.value === 0)
    playSfx('correct')
    hint.show(round.value.ok ?? (together.value ? '一塊門牌，打 localhost 就到' : '各自一塊門牌，各自生死'), 'good')
    later(nextRound, 1800)
    return
  }
  result.value = 'bad'
  missCount.value++
  playSfx('wrong')
  hint.show(missCount.value >= 2 ? (round.value.together ? '提示：兩隻放同一顆' : '提示：兩隻分開放') : round.value.why, 'bad', 2600)
  later(resetRound, 1400)
}

function resetRound() {
  if (status.value !== 'playing') return
  slots['0'] = null
  slots['1'] = null
  result.value = 'idle'
}

function nextRound() {
  if (status.value !== 'playing') return
  resetRound()
  missCount.value = 0
  if (!rounds.next()) status.value = 'won'
}

// 撞號時第二隻變紅搖晃，其他錯誤兩隻一起晃
function birdFx(bird: BirdKey) {
  if (result.value !== 'bad') return 'none'
  if (round.value.clash) return bird === '1' ? 'red' : 'none'
  return 'shake'
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell hint="把小鳥放進對的泡泡" :status="status" :aha="AHA" :progress="progress" @start="status = 'playing'" @finish="finish">
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="bubbles">
      <div
        v-for="b in (['A', 'B'] as BubbleKey[])"
        :key="b"
        class="room"
        :class="{
          'is-target': pp.picked.value !== null,
          'is-flash': flashTarget === `bubble-${b}`,
          shake: result === 'bad' && used(b),
        }"
      >
        <!-- 放置區鋪滿整顆泡泡，已放入的小鳥疊在上面 -->
        <button type="button" class="room__drop" :data-bubble="b" :aria-label="`放進泡泡 ${b}`" @click="tapBubble(b)" />
        <TagChip v-if="ipOf(b)" class="room__ip static pop-in" :text="ipOf(b)!" mono color="yellow" />
        <span class="room__name">泡泡 {{ b }}</span>
        <template v-for="(bird, n) in birdsIn(b)" :key="bird">
          <TagChip v-if="n === 1 && result === 'ok'" class="static pop-in" text="localhost" mono color="green" />
          <KChar
            id="bird"
            :size="44"
            :fx="birdFx(bird)"
            :label="round.birds[Number(bird)]"
            :data-placed="bird"
            class="room__bird"
            :class="{ 'is-flash': flashTarget === `placed-${bird}` }"
            @tap="tapPlaced(b, bird)"
          />
        </template>
        <KChar v-if="result === 'ok' && together && birdsIn(b).length === 2" class="room__bucket" id="food-bucket" :size="36" fx="bounce" disabled />
      </div>
    </div>

    <div class="tray paper">
      <small class="tray__label">第 {{ rounds.index.value + 1 }} 回合：點小鳥，再點泡泡</small>
      <div class="tray__birds">
        <div v-for="(name, i) in round.birds" :key="i" class="tray__bird">
          <KChar
            id="bird"
            :size="56"
            :data-bird="String(i)"
            :fx="slots[String(i) as BirdKey] ? 'ghost' : 'none'"
            :selected="pp.picked.value === String(i)"
            :class="{ 'is-flash': flashTarget === `bird-${i}` }"
            @tap="pickBird(String(i) as BirdKey)"
          />
          <TagChip :text="name" color="blue" @tap="pickBird(String(i) as BirdKey)" />
        </div>
      </div>
    </div>

    <template #controls>
      <button class="btn btn--primary blow" :class="{ 'is-flash': flashTarget === 'blow' }" data-test="blow" :disabled="!ready" @click="blow">吹泡泡</button>
    </template>
  </GameShell>
</template>

<style scoped>
.static {
  pointer-events: none;
}

.bubbles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 70px 10px 0;
}

/* 泡泡內部當成放置區，外觀沿用泡泡的透明殼 */
.room {
  position: relative;
  min-height: 230px;
  padding: 26px 4px 8px;
  border: 3px solid color-mix(in srgb, var(--sky-deep) 70%, #fff);
  border-radius: 50% / 38%;
  background: radial-gradient(circle at 30% 22%, #fff 0 8%, transparent 9%), color-mix(in srgb, var(--sky) 55%, #fff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.room__drop {
  position: absolute;
  inset: 0;
  padding: 0;
  border: none;
  border-radius: inherit;
  background: none;
  cursor: pointer;
}

.room__bird {
  position: relative;
  z-index: 1;
}

.room.is-flash {
  animation: day06-flash 0.8s ease-in-out infinite;
}

.kchar.is-flash :deep(.kchar__body) {
  animation: day06-glow 0.8s ease-in-out infinite;
}

.blow.is-flash {
  animation: day06-btn 0.8s ease-in-out infinite;
}

@keyframes day06-btn {
  50% {
    box-shadow: 0 0 0 5px var(--gold);
  }
}

@keyframes day06-flash {
  50% {
    border-color: var(--accent);
    box-shadow: 0 0 0 6px var(--gold);
  }
}

@keyframes day06-glow {
  50% {
    filter: drop-shadow(0 0 6px var(--gold)) drop-shadow(0 0 12px var(--accent));
  }
}

.room.is-target {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.room__name {
  position: absolute;
  pointer-events: none;
  bottom: -12px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--cloud);
  font-size: 0.8rem;
}

.room__ip {
  position: absolute;
  top: -18px;
  z-index: 2;
}

.room__bucket {
  position: absolute;
  pointer-events: none;
  right: 6px;
  bottom: 22px;
}

.tray {
  margin: auto 12px 12px;
  padding: 10px 12px;
  text-align: center;
}

.tray__label {
  color: var(--ink-soft);
}

.tray__birds {
  display: flex;
  justify-content: space-around;
  margin-top: 6px;
}

.tray__bird {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.blow {
  width: 100%;
  min-height: 52px;
}
</style>
