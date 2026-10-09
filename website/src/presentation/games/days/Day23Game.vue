<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, usePickPlace, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 23 雙層島混沌測試：接好資料庫設定，撐過重建、推 git、滾動更新三場意外
const emit = defineEmits<{ complete: [] }>()

type Slot = 'host' | 'password' | 'data'
type Card = 'ip' | 'name' | 'plain' | 'secret' | 'empty' | 'pvc'

const SLOTS: Array<{ id: Slot; label: string; right: Card; why: string }> = [
  { id: 'host', label: 'DB_HOST', right: 'name', why: 'IP 會變，用 Service 名稱找柱子' },
  { id: 'password', label: 'DB_PASSWORD', right: 'secret', why: '密碼要放進小盒子（Secret）' },
  { id: 'data', label: '資料放哪', right: 'pvc', why: 'emptyDir 會跟著泡泡一起消失' },
]
const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.label])) as Record<Slot, string>

const CARDS: Array<{ id: Card; text: string; slot: Slot }> = [
  { id: 'ip', text: '10.244.1.5', slot: 'host' },
  { id: 'name', text: 'hello-db', slot: 'host' },
  { id: 'plain', text: 'value: "p4ssw0rd"', slot: 'password' },
  { id: 'secret', text: 'secretKeyRef: db-secret', slot: 'password' },
  { id: 'empty', text: 'emptyDir', slot: 'data' },
  { id: 'pvc', text: 'PVC: db-data', slot: 'data' },
]
const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c])) as Record<Card, (typeof CARDS)[number]>

const AHA = '前端隨便死，資料庫的倉庫（PV）不能死。用名字找柱子、密碼從小盒拿、資料放倉庫，泡泡怎麼換都不怕。'

const status = ref<GameStatus>('intro')
const hint = useHint(2600)
const picker = usePickPlace<Card, Slot>({
  canPlace: (card, slot) => CARD[card].slot === slot || `這張卡要放「${SLOT_LABEL[CARD[card].slot]}」`,
})

const filled = reactive<Record<Slot, Card | null>>({ host: null, password: null, data: null })
const results = ref<Array<{ ok: boolean; text: string } | null>>([null, null, null])
const failedSlots = ref<Slot[]>([])
const failCount = reactive<Record<Slot, number>>({ host: 0, password: 0, data: 0 })
const running = ref(false)
const dbIp = ref('10.244.1.5')
const dbFx = ref<CharFx>('none')
const webFx = ref<CharFx>('none')
const storageLit = ref(false)
const lockboxLit = ref(false)

const placeMiss = ref(0)
const { later } = useTimeouts()
let completed = false

const ready = computed(() => SLOTS.every((s) => filled[s.id] !== null))
// 卡關保護：同一張卡連放錯 2 次，閃它該去的槽
const flashSlot = computed(() => (placeMiss.value >= 2 && picker.picked.value ? CARD[picker.picked.value].slot : null))
const flashCards = computed(() => SLOTS.filter((s) => failCount[s.id] >= 2 && filled[s.id] !== s.right).map((s) => s.right))

function pickCard(card: Card) {
  if (running.value) return
  playSfx('tap')
  if (picker.picked.value !== card) placeMiss.value = 0
  picker.pick(card)
}

function placeSlot(slot: Slot) {
  if (running.value) return
  const result = picker.place(slot)
  if (!result.ok) {
    if (picker.picked.value) placeMiss.value++
    playSfx('wrong')
    hint.show(result.reason, 'bad')
    return
  }
  playSfx('pop')
  placeMiss.value = 0
  filled[slot] = result.item
  failedSlots.value = failedSlots.value.filter((s) => s !== slot)
}

function runChaos() {
  if (!ready.value || running.value) return
  running.value = true
  results.value = [null, null, null]
  failedSlots.value = []
  storageLit.value = false
  lockboxLit.value = false
  webFx.value = 'none'
  dbIp.value = '10.244.1.5'
  dbFx.value = 'none'
  hint.clear()
  const hostOk = filled.host === 'name'
  const dataOk = filled.data === 'pvc'
  const passwordOk = filled.password === 'secret'

  // ① 資料庫泡泡被刪除重建，換了新 IP
  dbFx.value = 'pop'
  later(() => {
    if (status.value !== 'playing') return
    dbIp.value = '10.244.2.9'
    dbFx.value = 'bounce'
    webFx.value = hostOk ? 'none' : 'red'
    storageLit.value = dataOk
  }, 700)
  later(() => {
    if (status.value !== 'playing') return
    const text = hostOk && dataOk ? '換了新 IP，前端照連、資料還在' : !hostOk && !dataOk ? '連不上舊 IP，資料也空了' : !hostOk ? '前端還在打舊 IP，連不上' : '資料表全空了'
    report(0, hostOk && dataOk, text)
  }, 1300)

  // ② 把 Deployment YAML 推上 git
  later(() => {
    if (status.value !== 'playing') return
    lockboxLit.value = passwordOk
    report(1, passwordOk, passwordOk ? 'YAML 裡只有引用，安全' : '密碼跟著 YAML 外洩了')
  }, 2300)

  // ③ 前端滾動更新：全部換新也不影響
  later(() => status.value === 'playing' && (webFx.value = 'pop'), 2900)
  later(() => {
    if (status.value !== 'playing') return
    webFx.value = 'bounce'
    report(2, true, '前端全換新，照常運作')
    hint.show('前端不存東西，死一百次都無所謂', 'good')
  }, 3500)

  later(() => status.value === 'playing' && conclude(hostOk, passwordOk, dataOk), 4300)
}

function report(index: number, ok: boolean, text: string) {
  results.value[index] = { ok, text }
  playSfx(ok ? 'correct' : 'wrong')
}

function conclude(hostOk: boolean, passwordOk: boolean, dataOk: boolean) {
  running.value = false
  const failed = SLOTS.filter((s) => !{ host: hostOk, password: passwordOk, data: dataOk }[s.id])
  if (failed.length === 0) {
    status.value = 'won'
    return
  }
  failed.forEach((s) => failCount[s.id]++)
  failedSlots.value = failed.map((s) => s.id)
  hint.show(failed[0]!.why, 'bad', 3200)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="接好設定，撐過三場意外"
    :status="status"
    :aha="AHA"
    @start="status = 'playing'"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="scene">
      <div class="scene__row">
        <KChar v-for="n in 3" :key="n" id="bubble" :size="36" label="web" :fx="webFx" disabled />
      </div>
      <div class="scene__row">
        <KChar id="totem" :size="44" label="hello-db" disabled />
        <KChar id="lockbox" :size="32" label="db-secret" :fx="lockboxLit ? 'glow' : 'none'" disabled />
        <KChar id="bubble" :size="44" :label="dbIp" :fx="dbFx" disabled />
        <KChar id="borrow-slip" :size="30" :fx="storageLit ? 'glow' : 'dim'" disabled />
        <KChar id="warehouse" :size="40" :fx="storageLit ? 'glow' : 'dim'" disabled />
      </div>
    </div>

    <div class="slots">
      <button
        v-for="slot in SLOTS"
        :key="slot.id"
        class="slot"
        :class="{ 'is-failed': failedSlots.includes(slot.id), 'is-target': picker.picked.value !== null, 'is-flash': flashSlot === slot.id }"
        :data-slot="slot.id"
        @click="placeSlot(slot.id)"
      >
        <code class="slot__name">{{ slot.label }}</code>
        <span class="slot__value">{{ filled[slot.id] ? CARD[filled[slot.id]!].text : '點卡再點這裡' }}</span>
      </button>
    </div>

    <div class="cards">
      <TagChip
        v-for="card in CARDS"
        :key="card.id"
        :text="card.text"
        mono
        :color="flashCards.includes(card.id) ? 'yellow' : 'blue'"
        :class="{ 'is-flash': flashCards.includes(card.id) }"
        :selected="picker.picked.value === card.id"
        :data-card="card.id"
        @tap="pickCard(card.id)"
      />
    </div>

    <ol v-if="results.some((r) => r)" class="results">
      <li v-for="(r, i) in results" :key="i" :data-result="i" :class="r ? (r.ok ? 'is-ok' : 'is-bad') : ''">
        {{ ['資料庫重建', '推上 git', '前端滾動更新'][i] }}：{{ r ? `${r.ok ? '通過' : '失敗'}，${r.text}` : '…' }}
      </li>
    </ol>

    <template #controls>
      <button class="btn btn--primary chaos" data-test="chaos" :disabled="!ready || running" @click="runChaos">
        {{ running ? '測試中…' : '開始混沌測試' }}
      </button>
    </template>
  </GameShell>
</template>

<style scoped>
.scene {
  margin: 8px 6px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scene__row {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 4px 6px;
}

.slots {
  margin: 4px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slot {
  min-height: 44px;
  flex: none;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 2px dashed var(--ink-soft);
  border-radius: var(--radius-sm);
  background: var(--cloud);
  text-align: left;
}

.slot.is-target {
  border-color: var(--accent);
}

.slot.is-failed {
  border-style: solid;
  border-color: var(--danger);
  animation: shake 0.4s;
}

.slot__name {
  flex: none;
  width: 92px;
  font-size: 0.72rem;
  color: var(--ink-soft);
}

.slot__value {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.cards {
  margin: 6px 8px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 6px;
}

.slot.is-flash,
.cards .is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    box-shadow: 0 0 0 4px var(--gold);
  }
}

.results {
  margin: 2px 10px 10px;
  padding: 6px 10px 6px 28px;
  border-radius: var(--radius-sm);
  background: var(--cloud);
  font-size: 0.78rem;
  line-height: 1.6;
}

.results .is-ok {
  color: var(--leaf-deep);
}

.results .is-bad {
  color: var(--danger);
}

.chaos {
  width: 100%;
  min-height: 52px;
}
</style>
