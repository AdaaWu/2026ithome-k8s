<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, useTicker, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 16 大門看板：先請守門員，再從 3 張規則卡選 2 張，讓 6 位訪客各到對的柱子
const emit = defineEmits<{ complete: [] }>()

type Target = 'shop' | 'blog' | 'api'
type Outcome = Target | '404' | 'tcp'

interface Rule {
  host: string
  path: string
  to: Target
}
interface Visitor {
  text: string
  host: string
  path: string
  expect: Outcome
}

const BASE_RULE: Rule = { host: 'shop.example.com', path: '/', to: 'shop' }
const CARDS: Array<{ id: string; rule: Rule }> = [
  { id: 'blog', rule: { host: 'blog.example.com', path: '/', to: 'blog' } },
  { id: 'api', rule: { host: 'shop.example.com', path: '/api', to: 'api' } },
  { id: 'decoy', rule: { host: 'shop.example.com', path: '/api', to: 'shop' } },
]
const VISITORS: Visitor[] = [
  { text: 'shop.example.com/', host: 'shop.example.com', path: '/', expect: 'shop' },
  { text: 'blog.example.com/', host: 'blog.example.com', path: '/', expect: 'blog' },
  { text: 'shop.example.com/api', host: 'shop.example.com', path: '/api', expect: 'api' },
  { text: 'shop.example.com/cart', host: 'shop.example.com', path: '/cart', expect: 'shop' },
  { text: 'unknown.example.com/', host: 'unknown.example.com', path: '/', expect: '404' },
  { text: 'psql 5432（TCP）', host: '', path: '', expect: 'tcp' },
]
const TOTEMS: Target[] = ['shop', 'blog', 'api']
const AHA = '看板（Ingress）只是規則表，得有守門員（Ingress Controller）讀它才會動。規則不分先後，路徑最長的優先命中。'

const status = ref<GameStatus>('intro')
const phase = ref<'stuck' | 'rules' | 'flow'>('stuck')
const hint = useHint(2600)
const installed = ref(false)
const picked = ref<string[]>([])
const results = ref<Array<Outcome | 'timeout' | null>>(VISITORS.map(() => null))
const active = ref(0)
const totemFx = ref<Record<Target, CharFx>>({ shop: 'none', blog: 'none', api: 'none' })
const keeperFx = ref<CharFx>('ghost')
// 卡關保護：同一步錯 2 次就閃正確目標
const boardMisses = ref(0)
const ruleMisses = ref(0)
const { later } = useTimeouts()

let completed = false

const rules = computed(() => [BASE_RULE, ...CARDS.filter((c) => picked.value.includes(c.id)).map((c) => c.rule)])
const ruleText = (r: Rule) => `${r.host}${r.path === '/' ? '' : r.path} → ${r.to}`

// pathType Prefix 依路徑段比對，/api 不會命中 /apix
const prefixMatch = (rule: string, path: string) => rule === '/' || path === rule || path.startsWith(`${rule}/`)

// Ingress 規則沒有先後：同 host 中取最長的 path 前綴
function route(v: Visitor): Outcome {
  if (v.expect === 'tcp') return 'tcp'
  const hits = rules.value.filter((r) => r.host === v.host && prefixMatch(r.path, v.path))
  hits.sort((a, b) => b.path.length - a.path.length)
  return hits[0]?.to ?? '404'
}

function flash(target: Target, fx: CharFx) {
  totemFx.value[target] = 'none'
  later(() => (totemFx.value[target] = fx), 20)
  later(() => (totemFx.value[target] = 'none'), 900)
}

function begin() {
  status.value = 'playing'
  later(() => {
    if (status.value !== 'playing' || phase.value !== 'stuck' || installed.value) return
    results.value[0] = 'timeout'
    hint.show('規則寫好了，怎麼沒人動？', 'bad', 4000)
    playSfx('wrong')
  }, 2500)
}

function install() {
  if (status.value !== 'playing' || installed.value) return
  installed.value = true
  keeperFx.value = 'bounce'
  playSfx('unlock')
  hint.show('安裝 ingress-nginx，守門員上工', 'good')
  later(() => {
    if (status.value !== 'playing') return
    results.value[0] = 'shop'
    flash('shop', 'glow')
    playSfx('correct')
  }, 900)
  later(() => {
    if (status.value !== 'playing') return
    phase.value = 'rules'
    active.value = 1
    hint.show('從下面挑 2 張規則卡貼上看板', 'info')
  }, 1800)
}

function tapBoard() {
  playSfx('tap')
  if (!installed.value) boardMisses.value++
  hint.show(installed.value ? '規則不分先後，最長路徑優先' : '看板只是規則表，自己不會動', 'info')
}

function toggleCard(id: string) {
  if (phase.value !== 'rules') return
  playSfx('tap')
  const has = picked.value.includes(id)
  if (has) picked.value = picked.value.filter((p) => p !== id)
  else if (picked.value.length < 2) picked.value = [...picked.value, id]
  else hint.show('看板只剩 2 格，先取下一張', 'info')
}

function run() {
  // 只在選卡階段啟動，連點不會跑出第二個 ticker
  if (status.value !== 'playing' || phase.value !== 'rules' || picked.value.length !== 2) return
  // 兩張卡都寫 shop 的 /api 時無從判斷，視為錯誤並給正解
  if (picked.value.includes('api') && picked.value.includes('decoy')) {
    playSfx('wrong')
    ruleMisses.value++
    hint.show('/api 該送 api 柱子，留對的那張', 'bad')
    return
  }
  phase.value = 'flow'
  active.value = 1
  results.value = results.value.map((r, i) => (i === 0 ? r : null))
  ticker.start()
}

const ticker = useTicker(1300, (tick) => {
  const index = tick
  const visitor = VISITORS[index]
  if (!visitor) return
  active.value = index
  const outcome = route(visitor)
  results.value[index] = outcome
  if (outcome === 'tcp') {
    keeperFx.value = 'none'
    later(() => (keeperFx.value = 'shake'), 20)
    hint.show('看板只管 HTTP，TCP 走柱子', 'info', 2400)
  } else if (outcome !== visitor.expect) {
    playSfx('wrong')
    if (outcome !== '404') flash(outcome, 'shake')
    hint.show(`${visitor.path} 被送去 ${outcome} 了`, 'bad', 2400)
  } else {
    playSfx(outcome === '404' ? 'tap' : 'correct')
    if (outcome !== '404') flash(outcome, 'glow')
  }
  if (index === VISITORS.length - 1) {
    ticker.stop()
    later(endFlow, 1400)
  }
})

function endFlow() {
  if (status.value !== 'playing') return
  const allRight = VISITORS.every((v, i) => results.value[i] === v.expect)
  if (allRight) {
    playSfx('win')
    status.value = 'won'
    return
  }
  // 保留這輪紀錄，走錯的那列標 ✗
  phase.value = 'rules'
  ruleMisses.value++
  const wrong = VISITORS.findIndex((v, i) => results.value[i] !== v.expect)
  hint.show(`${VISITORS[wrong]!.text} 被送去 ${results.value[wrong]}，換一張規則卡`, 'bad', 4000)
}

function resultText(i: number): string {
  const r = results.value[i]
  if (r === null) return ''
  if (r === 'timeout') return 'timeout'
  if (r === 'tcp') return '不歸看板管'
  if (r === '404') return r === VISITORS[i]?.expect ? '404 ✓' : '404 ✗'
  return r === VISITORS[i]?.expect ? `→ ${r} ✓` : `→ ${r} ✗`
}

const isWrong = (i: number) => resultText(i).includes('✗') || resultText(i) === 'timeout'

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="請守門員、選規則，分流訪客"
    :status="status"
    :aha="AHA"
    :progress="{ current: results.filter((r) => r !== null && r !== 'timeout').length, total: VISITORS.length }"
    @start="begin"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="gate">
      <KChar id="gate-map" :size="56" @tap="tapBoard" />
      <div class="board">
        <small>看板規則</small>
        <span v-for="r in rules" :key="ruleText(r)" class="board__rule mono">{{ ruleText(r) }}</span>
      </div>
      <KChar
        id="gatekeeper"
        :size="56"
        :fx="keeperFx"
        :label="installed ? '守門員' : '點我安裝'"
        :disabled="installed"
        :class="{ 'is-flash': !installed && boardMisses >= 2 }"
        data-test="gatekeeper"
        @tap="install"
      />
    </div>

    <ol class="log">
      <template v-for="(v, i) in VISITORS" :key="v.text">
        <li
          v-if="i <= active"
          class="log__row"
          :class="{ 'is-active': i === active, 'is-wrong': isWrong(i) }"
          :data-test="i === active ? 'visitor' : undefined"
        >
          <span class="mono">{{ v.text }}</span>
          <b :class="{ 'is-bad': isWrong(i) }">{{ resultText(i) }}</b>
        </li>
      </template>
      <li v-if="active < VISITORS.length - 1" class="log__more">門外還有 {{ VISITORS.length - 1 - active }} 位</li>
    </ol>

    <!-- 規則卡放在舞台內，手機第一屏就看得到開門按鈕 -->
    <div v-if="phase === 'rules'" class="cards">
      <TagChip
        v-for="c in CARDS"
        :key="c.id"
        :text="`${picked.includes(c.id) ? '✓ ' : ''}${ruleText(c.rule)}`"
        mono
        color="blue"
        :selected="picked.includes(c.id)"
        :data-rule="c.id"
        class="cards__card"
        :class="{ 'is-flash': ruleMisses >= 2 && c.id !== 'decoy' }"
        @tap="toggleCard(c.id)"
      />
    </div>

    <div class="totems">
      <KChar
        v-for="t in TOTEMS"
        :key="t"
        id="totem"
        :size="64"
        :fx="totemFx[t]"
        :label="t"
        :badge="results.filter((r) => r === t).length || undefined"
        disabled
      />
    </div>

    <template #controls>
      <button v-if="phase === 'rules'" class="btn btn--primary cards__run" data-test="run" :disabled="picked.length !== 2" @click="run">
        開門放行（已選 {{ picked.length }}/2）
      </button>
      <p v-else class="wait">{{ phase === 'stuck' ? '訪客卡在門口……' : '守門員照看板分流中' }}</p>
    </template>
  </GameShell>
</template>

<style scoped>
.cards__card.is-flash,
.gate .is-flash :deep(.kchar__body) {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    box-shadow: 0 0 0 4px var(--gold);
  }
}

.mono {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
}

.gate {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 58px 8px 0;
  padding: 6px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--cloud) 75%, transparent);
}

.board {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.7rem;
}

.board small {
  color: var(--ink-soft);
}

.board__rule {
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--paper);
  border: 1.5px solid var(--sky-deep);
  overflow-wrap: anywhere;
}

.log {
  list-style: none;
  margin: 8px 10px 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.78rem;
}

.log__row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--cloud) 60%, transparent);
}

.log__row.is-active {
  outline: 2px solid var(--accent);
  background: var(--cloud);
}

.log__row b {
  color: var(--leaf-deep);
  white-space: nowrap;
}

.log__row b.is-bad {
  color: var(--danger);
}

.log__row.is-wrong {
  background: color-mix(in srgb, var(--danger) 14%, var(--cloud));
}

.log__more {
  text-align: center;
  color: var(--ink-soft);
  font-size: 0.72rem;
}

.totems {
  margin-top: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  justify-items: center;
  padding-bottom: 10px;
}

.cards {
  margin: 8px 10px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cards__card {
  width: 100%;
  min-height: 44px;
}

.cards__card.is-selected {
  background: color-mix(in srgb, var(--sky-deep) 40%, var(--cloud));
  font-weight: 700;
}

.cards__run {
  width: 100%;
  min-height: 52px;
}

.wait {
  margin: 0;
  min-height: 52px;
  display: grid;
  place-items: center;
  color: var(--ink-soft);
}
</style>
