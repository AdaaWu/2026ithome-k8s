<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import { GameShell, HintBubble, KChar, TagChip, useHint, usePickPlace, useTimeouts, type GameStatus } from '../kit'

// Day 28 管理者派工：DaemonSet、Job、CronJob、Deployment 各管一種形狀的工作
const emit = defineEmits<{ complete: [] }>()

type Card = 'logs' | 'migrate' | 'backup' | 'web'
type Manager = 'tree-guard-captain' | 'job-ticket' | 'cron-clock' | 'steward'
type Pod = 'run' | 'done' | 'crash'

const CARDS: Array<{ id: Card; text: string; short: string; right: Manager }> = [
  { id: 'logs', text: '每台機器收日誌', short: '收日誌', right: 'tree-guard-captain' },
  { id: 'migrate', text: '一次性資料遷移', short: '資料遷移', right: 'job-ticket' },
  { id: 'backup', text: '每天凌晨 3 點備份', short: '凌晨備份', right: 'cron-clock' },
  { id: 'web', text: '網站前端常駐', short: '前端常駐', right: 'steward' },
]
const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c])) as Record<Card, (typeof CARDS)[number]>

const MANAGERS: Array<{ id: Manager; name: string }> = [
  { id: 'tree-guard-captain', name: '守樹隊長' },
  { id: 'job-ticket', name: '委託單' },
  { id: 'cron-clock', name: '定時任務鐘' },
  { id: 'steward', name: '部署管家' },
]
const MANAGER_NAME = Object.fromEntries(MANAGERS.map((m) => [m.id, m.name])) as Record<Manager, string>

interface Outcome {
  ok: boolean
  text: string
  trees: Pod[][]
}

// 規格列出的組合；其餘一律視為「不負責」
const OUTCOMES: Partial<Record<`${Card}>${Manager}`, Outcome>> = {
  'logs>tree-guard-captain': { ok: true, text: '每棵樹各一顆，日誌全收到', trees: [['run'], ['run'], ['run']] },
  'logs>steward': { ok: false, text: '兩顆擠同一棵樹，一棵沒人收', trees: [['run', 'run'], ['run'], []] },
  'migrate>job-ticket': { ok: true, text: '跑完變 Completed，沒人重啟', trees: [['done'], [], []] },
  'migrate>steward': { ok: false, text: '跑完被重啟，最後 CrashLoopBackOff', trees: [['crash'], [], []] },
  'backup>cron-clock': { ok: true, text: '03:00 建委託單，跑完 Completed', trees: [[], ['done'], []] },
  'backup>job-ticket': { ok: false, text: '現在就跑一次，凌晨 3 點不會再跑', trees: [['done'], [], []] },
  'web>steward': { ok: true, text: '3 顆常駐，網站一直開著', trees: [['run'], ['run'], ['run']] },
  'web>job-ticket': { ok: false, text: '跑完就 Completed，網站關門了', trees: [['done'], [], []] },
}
const UNSUPPORTED: Outcome = { ok: false, text: '這位管理者不負責這種工作', trees: [[], [], []] }

const POD_VIEW: Record<Pod, { fx: 'bounce' | 'dim' | 'red'; label?: string }> = {
  run: { fx: 'bounce' },
  done: { fx: 'dim', label: 'Completed' },
  crash: { fx: 'red', label: 'CrashLoop' },
}

const AHA = 'CronJob 建 Job，Job 再建 Pod；守樹隊長（DaemonSet）看的是島上有幾棵樹。會結束的工作交給 Job，結束是正常的。'

const status = ref<GameStatus>('intro')
const hint = useHint(2600)
const picker = usePickPlace<Card, Manager>()

const assigned = reactive<Record<Manager, Card | null>>({ 'tree-guard-captain': null, 'job-ticket': null, 'cron-clock': null, steward: null })
const passed = ref<Card[]>([])
const failCount = reactive<Record<Card, number>>({ logs: 0, migrate: 0, backup: 0, web: 0 })
const worklog = ref<Array<{ ok: boolean; text: string }>>([])
const trees = ref<Pod[][]>([[], [], []])
const active = ref<{ manager: Manager; ok: boolean } | null>(null)
const running = ref(false)
const step = ref<'assign' | 'egg' | 'grown'>('assign')

const { later: schedule } = useTimeouts()
// 延遲回呼只在本局進行中才生效
const later = (fn: () => void, ms: number) =>
  schedule(() => {
    if (status.value === 'playing') fn()
  }, ms)
let completed = false

const placedCards = computed(() => Object.values(assigned).filter((c): c is Card => c !== null))
const tray = computed(() => CARDS.filter((c) => !placedCards.value.includes(c.id)))
const flashManager = computed(() => {
  const card = picker.picked.value
  return card && failCount[card] >= 2 ? CARD[card].right : null
})

function pickCard(card: Card) {
  if (running.value) return
  playSfx('tap')
  picker.pick(card)
}

// 管理者只有一個槽：放上新卡時舊卡退回卡區
function placeAt(manager: Manager) {
  if (running.value || step.value !== 'assign') return
  if (assigned[manager] && passed.value.includes(assigned[manager]!)) return
  // 沒選卡時點已派的管理者，等於把卡收回
  if (!picker.picked.value && assigned[manager]) {
    playSfx('tap')
    assigned[manager] = null
    return
  }
  const result = picker.place(manager)
  if (!result.ok) {
    hint.show('先點一張工作卡', 'info')
    return
  }
  playSfx('pop')
  assigned[manager] = result.item
}

function work() {
  if (running.value || tray.value.length > 0) return
  running.value = true
  worklog.value = []
  const queue = MANAGERS.map((m) => m.id).filter((m) => !passed.value.includes(assigned[m]!))
  queue.forEach((manager, i) => later(() => play(manager), i * 1300))
  later(conclude, queue.length * 1300 + 200)
}

function play(manager: Manager) {
  const card = assigned[manager]!
  const outcome = OUTCOMES[`${card}>${manager}`] ?? UNSUPPORTED
  trees.value = outcome.trees
  active.value = { manager, ok: outcome.ok }
  worklog.value.push({ ok: outcome.ok, text: `${CARD[card].short} → ${MANAGER_NAME[manager]}：${outcome.text}` })
  playSfx(outcome.ok ? 'correct' : 'wrong')
  if (outcome.ok) passed.value.push(card)
  else {
    failCount[card]++
    assigned[manager] = null
  }
}

function conclude() {
  running.value = false
  active.value = null
  if (passed.value.length < CARDS.length) {
    hint.show('派錯的卡退回來了，再派一次', 'bad')
    return
  }
  trees.value = [['run'], ['run'], ['run']]
  step.value = 'egg'
  hint.show('全部到位！點空地種一棵新樹', 'good', 6000)
}

function plantTree() {
  if (step.value !== 'egg') return
  step.value = 'grown'
  playSfx('pop')
  trees.value = [...trees.value, []]
  later(() => {
    trees.value = [['run'], ['run'], ['run'], ['run']]
    active.value = { manager: 'tree-guard-captain', ok: true }
    playSfx('correct')
    hint.show('守樹隊長自動補上一顆', 'good')
  }, 800)
  later(() => (status.value = 'won'), 2200)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell hint="把工作交給對的管理者" :status="status" :aha="AHA" @start="status = 'playing'" @finish="finish">
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="tray">
      <TagChip
        v-for="card in tray"
        :key="card.id"
        :text="card.text"
        color="yellow"
        :selected="picker.picked.value === card.id"
        :data-card="card.id"
        @tap="pickCard(card.id)"
      />
      <small v-if="tray.length === 0 && step === 'assign'" class="tray__done">卡都派出去了，按「上工！」</small>
    </div>

    <div class="managers">
      <button
        v-for="m in MANAGERS"
        :key="m.id"
        class="manager"
        :class="{
          'is-target': picker.picked.value !== null,
          'is-flash': flashManager === m.id,
          'is-ok': active?.manager === m.id && active.ok,
          shake: active?.manager === m.id && !active.ok,
        }"
        :data-manager="m.id"
        @click="placeAt(m.id)"
      >
        <CharacterSprite :id="m.id" :size="46" />
        <small class="manager__name">{{ m.name }}</small>
        <span class="manager__slot" :class="{ 'is-passed': assigned[m.id] && passed.includes(assigned[m.id]!) }">
          {{ assigned[m.id] ? CARD[assigned[m.id]!].short : '空' }}
        </span>
      </button>
    </div>

    <div class="field">
      <div v-for="(pods, i) in trees" :key="i" class="field__tree">
        <div class="field__pods">
          <KChar v-for="(pod, j) in pods" :key="j" id="bubble" :size="26" :fx="POD_VIEW[pod].fx" :label="POD_VIEW[pod].label" disabled />
        </div>
        <KChar id="tree" :size="58" :fx="i === 3 ? 'bounce' : 'none'" disabled />
      </div>
      <div v-if="step === 'egg'" class="field__tree">
        <KChar id="tree" :size="58" fx="ghost" class="field__plant" data-test="new-tree" @tap="plantTree" />
      </div>
    </div>

    <ul v-if="worklog.length" class="worklog" data-test="worklog">
      <li v-for="(line, i) in worklog" :key="i" :class="line.ok ? 'is-ok' : 'is-bad'">{{ line.ok ? '✓' : '✗' }} {{ line.text }}</li>
    </ul>

    <template #controls>
      <button
        class="btn btn--primary go"
        data-test="work"
        :disabled="running || tray.length > 0 || step !== 'assign'"
        @click="work"
      >
        {{ running ? '上工中…' : '上工！' }}
      </button>
    </template>
  </GameShell>
</template>

<style scoped>
.tray {
  margin: 56px 10px 6px;
  min-height: 44px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 8px;
}

.tray__done {
  align-self: center;
  color: var(--ink-soft);
}

.managers {
  margin: 0 6px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.manager {
  padding: 4px 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--cloud) 70%, transparent);
}

.manager.is-target {
  border-color: var(--accent-soft);
}

.manager.is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

.manager.is-ok {
  border-color: var(--success);
  filter: drop-shadow(0 0 6px var(--gold));
}

.manager__name {
  font-size: 0.72rem;
}

.manager__slot {
  width: 100%;
  min-height: 24px;
  border: 2px dashed var(--ink-soft);
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  line-height: 20px;
}

.manager__slot.is-passed {
  border-style: solid;
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 18%, var(--cloud));
}

@keyframes flash {
  50% {
    border-color: var(--gold);
    background: var(--accent-soft);
  }
}

.field {
  margin: 8px 6px 0;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 4px;
}

.field__tree {
  width: 78px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.field__pods {
  min-height: 62px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.field__plant :deep(.kchar__body) {
  animation: bob 1.4s ease-in-out infinite;
}

.worklog {
  margin: 6px 10px 10px;
  padding: 6px 10px;
  list-style: none;
  border-radius: var(--radius-sm);
  background: var(--cloud);
  font-size: 0.76rem;
  line-height: 1.6;
}

.worklog .is-ok {
  color: var(--leaf-deep);
}

.worklog .is-bad {
  color: var(--danger);
}

.go {
  width: 100%;
  min-height: 52px;
}
</style>
