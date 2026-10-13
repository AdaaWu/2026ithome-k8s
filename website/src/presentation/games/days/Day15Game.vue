<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChoiceCards, GameShell, HintBubble, KChar, useHint, useRounds, useTimeouts, type CharFx, type CharacterId, type GameStatus } from '../kit'

// Day 15 入口開幾層：依需求選最小夠用的 Service type，外層會連內層一起開
const emit = defineEmits<{ complete: [] }>()

type Pick = 'cluster' | 'node' | 'lb' | 'pf'
type Visitor = 'inside' | 'colleague' | 'world' | 'laptop'

interface Round {
  need: string
  who: Visitor[]
  answer: Pick
  kind?: boolean
}

const ROUNDS: Round[] = [
  { need: '資料庫只給島內前端用', who: ['inside'], answer: 'cluster' },
  { need: '同事要從筆電連測試服務，他連得到節點 IP', who: ['colleague'], answer: 'node' },
  { need: '正式網站要給全世界用，跑在雲端', who: ['world'], answer: 'lb' },
  { need: '在 Kind 筆電上（macOS／Windows 預設），想用瀏覽器打開', who: ['laptop'], answer: 'pf', kind: true },
]

const OPTIONS = [
  { id: 'cluster', label: 'ClusterIP', sub: '島內路標' },
  { id: 'node', label: 'NodePort', sub: '樹幹上的小門' },
  { id: 'lb', label: 'LoadBalancer', sub: '海邊碼頭' },
]
const PF_OPTION = { id: 'pf', label: 'port-forward', sub: 'kubectl 拉線到筆電' }

// 由外而內排列；rank 越大開得越外層
const LAYERS: Array<{ pick: Pick; id: CharacterId; name: string; rank: number }> = [
  { pick: 'lb', id: 'totem-dock', name: 'LoadBalancer', rank: 3 },
  { pick: 'node', id: 'totem-gate', name: 'NodePort', rank: 2 },
  { pick: 'cluster', id: 'totem-inner', name: 'ClusterIP', rank: 1 },
]
const RANK: Record<Pick, number> = { cluster: 1, node: 2, lb: 3, pf: 0 }

const VISITORS: Array<{ id: Visitor; name: string }> = [
  { id: 'inside', name: '島內泡泡' },
  { id: 'colleague', name: '連得到節點的同事' },
  { id: 'world', name: '海上的網友' },
  { id: 'laptop', name: '你的 Kind 筆電' },
]
const REACH: Record<Pick, Visitor[]> = {
  cluster: ['inside'],
  node: ['inside', 'colleague'],
  lb: ['inside', 'colleague', 'world'],
  pf: ['laptop'],
}

const AHA = 'ClusterIP 只開島內，NodePort 加開巢樹入口，LoadBalancer 再接外部負載平衡器。外層包內層，夠用就別往外開。'

const status = ref<GameStatus>('intro')
const rounds = useRounds(ROUNDS)
const hint = useHint(2600)
const chosen = ref<Pick | null>(null)
const attempted = ref(false)
const missCount = ref(0)
const roundMisses = ref(0)
const locked = ref(false)
const { later, clearAll } = useTimeouts()

let completed = false

const round = computed(() => rounds.current.value)
const options = computed(() => (round.value.kind ? [...OPTIONS, PF_OPTION] : OPTIONS))
const pending = computed(() => round.value.kind && chosen.value === 'lb')
// 卡關保護：同一回合錯 2 次就閃正確選項
const flashId = computed(() => (roundMisses.value >= 2 ? round.value.answer : undefined))
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: ROUNDS.length,
}))

// 選外層時內層一起亮，表現層層包含
function layerFx(rank: number): CharFx {
  if (chosen.value === null) return 'none'
  return rank <= RANK[chosen.value] ? 'glow' : 'dim'
}

function mark(v: Visitor): string {
  if (chosen.value === null) return ''
  const reached = REACH[chosen.value].includes(v) && !(pending.value && v === 'world')
  if (reached) return '✓'
  return round.value.who.includes(v) ? '✗' : ''
}

function whyWrong(pick: Pick): string {
  const r = round.value
  if (r.kind) {
    if (pick === 'lb') return '筆電上沒有雲端負載平衡器接單'
    if (pick === 'node') return 'macOS／Windows 上 Kind 預設沒把樹的埠接到筆電'
    return 'ClusterIP 在島外打不通'
  }
  return RANK[pick] > RANK[r.answer] ? '每多開一層，就多一個對外的攻擊面' : '需要的人連不進來'
}

function choose(id: string, correct: boolean) {
  if (status.value !== 'playing' || locked.value) return
  const pick = id as Pick
  chosen.value = pick
  if (!attempted.value) {
    attempted.value = true
    rounds.record(correct)
    if (!correct) missCount.value++
  }
  if (!correct) {
    roundMisses.value++
    hint.show(whyWrong(pick), 'bad')
    if (missCount.value >= 2) {
      // 第 2 回合答錯立刻鎖住，讓玩家先看完原因再判失敗
      locked.value = true
      later(() => {
        if (status.value === 'playing') status.value = 'lost'
      }, 1400)
    }
    return
  }
  locked.value = true
  const clean = rounds.results.value[rounds.index.value] === 'ok'
  hint.show(clean ? (pick === 'pf' ? '延長線直接拉到瀏覽器前' : '剛剛好，最小夠用') : '這才是最小夠用的那層', 'good')
  later(nextRound, 1300)
}

function nextRound() {
  if (status.value !== 'playing') return
  chosen.value = null
  attempted.value = false
  roundMisses.value = 0
  locked.value = false
  if (!rounds.next()) status.value = 'won'
}

function retry() {
  clearAll()
  rounds.reset()
  chosen.value = null
  attempted.value = false
  missCount.value = 0
  roundMisses.value = 0
  locked.value = false
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
    hint="選最小夠用的柱子型號"
    :status="status"
    :aha="AHA"
    :progress="progress"
    lose-text="錯了 2 回合。想想誰需要連進來，只開到那一層就好"
    @start="status = 'playing'"
    @retry="retry"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="island">
      <div class="layers">
        <div v-for="layer in LAYERS" :key="layer.pick" class="layer">
          <KChar :id="layer.id" :size="72" :fx="layerFx(layer.rank)" :label="layer.name" disabled />
          <span v-if="layer.pick === 'lb' && pending" class="pending mono">EXTERNAL-IP &lt;pending&gt;</span>
        </div>
      </div>
      <div class="island__axis"><small>← 島外</small><small>島內 →</small></div>
    </div>

    <div class="visitors">
      <span
        v-for="v in VISITORS"
        :key="v.id"
        class="visitor"
        :class="{ 'is-need': round.who.includes(v.id), 'is-hidden': (v.id === 'laptop') !== !!round.kind }"
      >
        {{ v.name }} <b>{{ mark(v.id) }}</b>
      </span>
    </div>

    <div class="need paper">
      <small data-test="round">第 {{ rounds.index.value + 1 }} 回合</small>
      <p class="need__text">{{ round.need }}</p>
    </div>

    <!-- 選項放進舞台，手機第一屏就看得到 -->
    <fieldset class="choices-wrap" :disabled="locked" :data-flash="flashId">
      <ChoiceCards :key="rounds.index.value + status" :options="options" :answer="round.answer" :columns="2" @choose="choose" />
    </fieldset>
  </GameShell>
</template>

<style scoped>
.mono {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
}

.island {
  margin: 60px 10px 0;
  padding: 10px 0 6px;
  border-radius: var(--radius-md);
  background: linear-gradient(90deg, color-mix(in srgb, var(--sky-deep) 45%, var(--cloud)) 0%, color-mix(in srgb, var(--bark) 25%, var(--cloud)) 50%, color-mix(in srgb, var(--leaf) 40%, var(--cloud)) 100%);
}

.layers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.layer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.pending {
  font-size: 0.66rem;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  background: var(--cloud);
  border: 1.5px dashed var(--danger);
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  50% {
    opacity: 0.4;
  }
}

.island__axis {
  display: flex;
  justify-content: space-between;
  padding: 4px 10px 0;
  color: var(--ink-soft);
}

.visitors {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
}

.visitor {
  padding: 4px 10px;
  border-radius: 999px;
  border: 2px solid var(--ink-soft);
  background: var(--cloud);
  font-size: 0.8rem;
}

.visitor.is-need {
  border-color: var(--gold);
  background: color-mix(in srgb, var(--gold) 25%, var(--cloud));
  font-weight: 700;
}

.visitor.is-hidden {
  display: none;
}

.need {
  margin: auto 12px 8px;
  padding: 8px 12px;
  text-align: center;
}

.need small {
  color: var(--ink-soft);
}

.need__text {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
}

.choices-wrap {
  min-width: 0;
  margin: 0 12px 12px;
  padding: 0;
  border: 0;
}

.choices-wrap[data-flash='cluster'] :deep([data-choice='cluster']),
.choices-wrap[data-flash='node'] :deep([data-choice='node']),
.choices-wrap[data-flash='lb'] :deep([data-choice='lb']),
.choices-wrap[data-flash='pf'] :deep([data-choice='pf']) {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}
</style>
