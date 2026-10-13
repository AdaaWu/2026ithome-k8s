<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, useRounds, useTimeouts, type CharacterId, type GameStatus } from '../kit'

// Day 17 狀態碼分診：看狀態碼決定先查哪一站，用最少檢查次數找到斷點
const emit = defineEmits<{ complete: [] }>()

type StationId = 'controller' | 'ingress' | 'service' | 'endpoints' | 'pod'

interface Station {
  id: StationId
  // 沒有對應角色的站用文字名單卡
  char?: CharacterId
  name: string
  cmd: string
  ok: string
}
interface Round {
  code: string
  path: string
  broken: StationId
  output: string[]
  why: string
  // 這回合泡泡站的輸出，沒寫就用健康的輸出
  pod?: string
}

const STATIONS: Station[] = [
  { id: 'controller', char: 'gatekeeper', name: '守門員', cmd: 'kubectl get po -n ingress-nginx', ok: 'controller  1/1  Running' },
  { id: 'ingress', char: 'gate-map', name: '看板', cmd: 'kubectl describe ingress hello', ok: '/hello → hello:80' },
  { id: 'service', char: 'totem', name: '柱子', cmd: 'kubectl get svc hello', ok: 'hello  ClusterIP  10.96.123.45' },
  { id: 'endpoints', name: '名單', cmd: 'kubectl get endpointslices -l …', ok: '10.244.0.5:80 等 3 筆' },
  { id: 'pod', char: 'bubble', name: '泡泡', cmd: 'kubectl get pods -l app=hello', ok: '3 顆 1/1 Running' },
]
const ROUNDS: Round[] = [
  {
    code: '503',
    path: '/hello',
    broken: 'endpoints',
    output: ['ENDPOINTS  <unset>'],
    why: '503：規則有了，柱子後面沒人',
    pod: '3 顆 0/1 Running（Readiness 未過）',
  },
  {
    code: '503',
    path: '/hello',
    broken: 'ingress',
    output: ['/hello → hello-typo:80', '<error: services "hello-typo"…'],
    why: '503：看板指向不存在的柱子',
  },
  { code: '404', path: '/nothing', broken: 'ingress', output: ['Rules: /hello → hello:80', '沒有 /nothing 這條規則'], why: '404：看板沒有這條規則' },
  { code: '連不上', path: '/hello', broken: 'controller', output: ['controller 0/1 CrashLoopBackOff'], why: '連不上：守門員本身沒起來' },
]
const BUDGET = 10
const AHA = '先看狀態碼分診，再一站一站問。404 是看板沒規則，503 是規則有了但後面沒人，連不上是守門員沒起來。'
const LOSE = '分診表：404 看板沒規則、503 規則有了但後面沒人、連不上是守門員沒起來'

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

const status = ref<GameStatus>('intro')
// 回合順序放在 reactive 陣列，retry 時就地重新洗牌
const order = reactive(shuffle(ROUNDS))
const rounds = useRounds(order)
const hint = useHint(2600)
const checks = ref(0)
const checked = ref<Partial<Record<StationId, 'ok' | 'bad'>>>({})
const lastStation = ref<Station | null>(null)
const locked = ref(false)
const shaking = ref<StationId | null>(null)

const { later, clearAll } = useTimeouts()

let completed = false

const round = computed(() => rounds.current.value)
const healthyChecks = computed(() => Object.values(checked.value).filter((v) => v === 'ok').length)
// 卡關保護：同回合問了 2 站正常就閃斷點；檢查次數用完就不閃
const canFlash = computed(() => healthyChecks.value >= 2 && !locked.value && checks.value < BUDGET)
const output = computed(() => {
  const s = lastStation.value
  if (!s) return ['（點一站執行檢查）']
  if (checked.value[s.id] === 'bad') return round.value.output
  return [s.id === 'pod' && round.value.pod ? round.value.pod : s.ok]
})
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: ROUNDS.length,
}))

function fxOf(id: StationId) {
  if (shaking.value === id) return 'shake'
  const state = checked.value[id]
  return state === 'bad' ? 'red' : state === 'ok' ? 'dim' : 'none'
}

function badgeOf(id: StationId) {
  const state = checked.value[id]
  return state === 'ok' ? '✓' : state === 'bad' ? '✗' : undefined
}

function check(station: Station) {
  if (status.value !== 'playing' || locked.value || checked.value[station.id]) return
  checks.value++
  lastStation.value = station
  const broken = station.id === round.value.broken
  checked.value = { ...checked.value, [station.id]: broken ? 'bad' : 'ok' }

  if (checks.value > BUDGET) {
    playSfx('wrong')
    status.value = 'lost'
    return
  }
  if (!broken) {
    playSfx('tap')
    shaking.value = station.id
    later(() => (shaking.value = null), 400)
    hint.show('這站正常，換下一站問', 'info')
    return
  }
  playSfx('correct')
  rounds.record(healthyChecks.value === 0)
  hint.show(round.value.why, 'good')
  locked.value = true
  later(nextRound, 1300)
}

function nextRound() {
  if (status.value !== 'playing') return
  checked.value = {}
  lastStation.value = null
  locked.value = false
  if (rounds.next()) return
  playSfx('win')
  status.value = 'won'
}

function retry() {
  clearAll()
  order.splice(0, order.length, ...shuffle(ROUNDS))
  rounds.reset()
  checks.value = 0
  checked.value = {}
  lastStation.value = null
  locked.value = false
  shaking.value = null
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
    hint="看狀態碼，最少檢查找斷點"
    :status="status"
    :aha="AHA"
    :lose-text="LOSE"
    :progress="progress"
    @start="status = 'playing'"
    @retry="retry"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="browser paper">
      <TagChip :text="`curl localhost${round.path}`" mono color="blue" class="browser__url" disabled />
      <b class="browser__code" :class="{ 'is-timeout': round.code === '連不上' }" data-test="code">{{ round.code }}</b>
    </div>

    <div class="stations">
      <div v-for="s in STATIONS" :key="s.id" class="station">
        <KChar
          v-if="s.char"
          :id="s.char"
          :size="56"
          :label="s.name"
          :badge="badgeOf(s.id)"
          :fx="fxOf(s.id)"
          :class="{ 'is-flash': canFlash && s.id === round.broken }"
          :data-station="s.id"
          @tap="check(s)"
        />
        <button
          v-else
          type="button"
          class="list-card"
          :class="[`list-card--${fxOf(s.id)}`, { 'is-flash': canFlash && s.id === round.broken }]"
          :data-station="s.id"
          @click="check(s)"
        >
          <span class="list-card__body paper">
            <b>Endpoints</b>
            <i />
            <i />
            <i />
            <span v-if="badgeOf(s.id)" class="list-card__badge">{{ badgeOf(s.id) }}</span>
          </span>
          <span class="list-card__label">{{ s.name }}</span>
        </button>
      </div>
    </div>

    <div class="terminal">
      <p class="terminal__cmd">$ {{ lastStation ? lastStation.cmd : 'kubectl …' }}</p>
      <p v-for="line in output" :key="line" class="terminal__line">{{ line }}</p>
      <small class="terminal__count" :class="{ 'is-urgent': checks >= BUDGET - 2 }" data-test="checks">
        檢查 {{ checks }} / {{ BUDGET }}
      </small>
    </div>
  </GameShell>
</template>

<style scoped>
.browser {
  margin: 60px 12px 0;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.browser__code {
  font-family: var(--font-display);
  font-size: 2rem;
  line-height: 1;
  color: var(--danger);
}

.browser__code.is-timeout {
  font-size: 1.3rem;
  white-space: nowrap;
}

.browser__url:disabled {
  opacity: 1;
}

.stations {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 14px;
  padding: 12px 12px 0;
}

.station {
  width: 88px;
  display: flex;
  justify-content: center;
}

.station :deep(.kchar__label) {
  font-size: 0.8rem;
  font-weight: 700;
}

.is-flash :deep(.kchar__body),
.list-card.is-flash .list-card__body {
  animation: flash 0.8s ease-in-out infinite;
}

/* 名單（Endpoints）沒有角色，用文字卡呈現 */
.list-card {
  min-width: 44px;
  padding: 0;
  border: none;
  background: none;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.list-card__body {
  position: relative;
  width: 56px;
  height: 56px;
  padding: 6px 5px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: filter 0.25s, opacity 0.25s;
}

.list-card__body b {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.55rem;
  line-height: 1;
}

.list-card__body i {
  height: 3px;
  border-radius: 2px;
  background: var(--ink-soft);
}

.list-card__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: var(--accent);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}

.list-card__label {
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cloud) 85%, transparent);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--ink);
  white-space: nowrap;
}

.list-card--dim .list-card__body {
  filter: grayscale(0.7) brightness(0.85);
  opacity: 0.55;
}

.list-card--red .list-card__body {
  filter: sepia(1) saturate(4) hue-rotate(-35deg) brightness(0.9);
}

.list-card--shake .list-card__body {
  animation: shake 0.4s;
}

@keyframes flash {
  50% {
    filter: drop-shadow(0 0 8px var(--accent));
  }
}

.terminal {
  margin: auto 12px 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: #3d2f25;
  color: #f6efe2;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 0.76rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.terminal p {
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.terminal__cmd {
  color: var(--gold);
}

.terminal__count {
  align-self: flex-end;
  margin-top: 4px;
  color: var(--accent-soft);
}

.terminal__count.is-urgent {
  color: #ff9a8a;
}
</style>
