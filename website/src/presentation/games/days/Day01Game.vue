<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import { GameShell, HintBubble, KChar, Meter, useCountdown, useHint, usePickPlace, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 1 半夜救火員：先手動搬小鳥救火，再寫下期望狀態，看島自己補新泡泡
const emit = defineEmits<{ complete: [] }>()

type TreeId = 'A' | 'B' | 'C'
type Phase = 'manual' | 'switch' | 'declare'

interface Pod {
  key: number
  name: string
  tree: TreeId | null // null：地上的小鳥或 Pending 的泡泡
  fx: CharFx
  fresh?: boolean
}

const TREES: TreeId[] = ['A', 'B', 'C']
const SLOTS = 3
const DESIRED = 6
const MANUAL_SEC = 15
const PUSHES_TO_WIN = 2
// 第一階段固定的倒樹時間（秒），倒下 6 秒後換新機器長回來
const KNOCKS: Array<{ at: number; tree: TreeId }> = [
  { at: 1, tree: 'A' },
  { at: 8, tree: 'B' },
]
const MANUAL_REGROW_MS = 6000
const RESCHEDULE_MS = 2000
const DECLARE_REGROW_MS = 5000

const AHA = '你宣告想要的結果，K8s 持續把現況拉向它。補上的是新吹的泡泡（Pod），樹不夠時先 Pending，有位置再掛。'

const status = ref<GameStatus>('intro')
const phase = ref<Phase>('manual')
const down = ref<Record<TreeId, boolean>>({ A: false, B: false, C: false })
const units = ref<Pod[]>([])
const shakingTree = ref<TreeId | null>(null)
const pushes = ref(0)
const rescued = ref(0)
const missCount = ref(0)
const log = ref('')
const hint = useHint(2600)
const pickPlace = usePickPlace<string, TreeId>({ canPlace: (_, tree) => placeVerdict(tree) })
const countdown = useCountdown(MANUAL_SEC, { onExpire: endManual })

let nextKey = 0
let completed = false
const { later } = useTimeouts()

const podName = () => `web-${Math.random().toString(36).slice(2, 6)}`
const onTree = (tree: TreeId) => units.value.filter((u) => u.tree === tree)
const running = computed(() => units.value.filter((u) => u.tree && !down.value[u.tree] && u.fx !== 'pop').length)
const grounded = computed(() => units.value.filter((u) => u.tree === null))
// 卡關保護：同一步連錯 2 次，閃出現在能點的目標
const flashTree = computed(() => {
  if (missCount.value < 2) return null
  if (phase.value === 'manual' && pickPlace.picked.value === null) return null
  return TREES.find((t) => (phase.value === 'manual' ? placeVerdict(t) === true : !down.value[t])) ?? null
})
const flashBird = computed(() => missCount.value >= 2 && phase.value === 'manual' && pickPlace.picked.value === null)
const timer = computed(() => (phase.value === 'manual' ? { remaining: countdown.remaining.value, total: MANUAL_SEC } : undefined))

function placeVerdict(tree: TreeId): true | string {
  if (down.value[tree]) return '這台倒了，換一棵'
  if (onTree(tree).length >= SLOTS) return '這棵滿了，換一棵'
  return true
}

function start() {
  status.value = 'playing'
  units.value = TREES.flatMap((tree) => [0, 1].map(() => ({ key: ++nextKey, name: podName(), tree, fx: 'none' as CharFx })))
  countdown.start()
  KNOCKS.forEach(({ at, tree }) => later(() => knockManual(tree), at * 1000))
}

// 第一階段：樹倒下，上面的小鳥掉到地上等你搬
function knockManual(tree: TreeId) {
  if (status.value !== 'playing' || phase.value !== 'manual') return
  down.value[tree] = true
  onTree(tree).forEach((u) => (u.tree = null))
  playSfx('wrong')
  hint.show(`樹 ${tree} 倒了！快把小鳥搬走`, 'bad')
  later(() => {
    if (status.value === 'playing') down.value[tree] = false
  }, MANUAL_REGROW_MS)
}

function endManual() {
  phase.value = 'switch'
  missCount.value = 0
  pickPlace.cancel()
  hint.show(`救回 ${rescued.value} 隻。凌晨三點還醒著嗎？`, 'info', 3200)
}

function tapGround(key: string) {
  if (phase.value !== 'manual') return
  playSfx('tap')
  pickPlace.pick(key)
}

function tapTree(tree: TreeId) {
  if (status.value !== 'playing') return
  if (phase.value === 'manual') return placeBird(tree)
  if (phase.value === 'declare') pushTree(tree)
}

function placeBird(tree: TreeId) {
  const result = pickPlace.place(tree)
  if (!result.ok) {
    missCount.value++
    if (result.reason === '先選一個') return hint.show('先點地上的小鳥', 'info')
    shake(tree)
    return hint.show(result.reason, 'bad')
  }
  const bird = units.value.find((u) => String(u.key) === result.item)
  if (!bird) return
  bird.tree = tree
  rescued.value++
  missCount.value = 0
  playSfx('correct')
}

function shake(tree: TreeId) {
  playSfx('wrong')
  shakingTree.value = tree
  later(() => (shakingTree.value = null), 400)
}

// 第二階段：每隻小鳥包進泡泡，交給島照期望數量維持
function declare() {
  if (phase.value !== 'switch') return
  units.value = []
  for (let i = 0; i < DESIRED; i++) units.value.push({ key: ++nextKey, name: podName(), tree: null, fx: 'bounce' })
  schedule()
  phase.value = 'declare'
  missCount.value = 0
  playSfx('unlock')
  hint.show('換你當搗蛋鬼：推倒一棵樹', 'info', 3000)
  later(() => {
    if (status.value === 'playing' && pushes.value === 0) hint.show('點一棵樹把它推倒', 'info')
  }, 7000)
}

function pushTree(tree: TreeId) {
  if (pushes.value >= PUSHES_TO_WIN) return
  if (down.value[tree]) {
    missCount.value++
    shake(tree)
    return hint.show('這棵已經倒了，推別棵', 'bad')
  }
  missCount.value = 0
  pushes.value++
  down.value[tree] = true
  playSfx('pop')
  const victims = onTree(tree)
  victims.forEach((u) => (u.fx = 'pop'))
  later(() => {
    if (status.value === 'playing') units.value = units.value.filter((u) => !victims.includes(u))
  }, 350)
  log.value = `樹 ${tree} 倒了，${victims.length} 顆泡泡跟著破`
  later(reconcile, RESCHEDULE_MS)
  later(() => {
    if (status.value !== 'playing') return
    down.value[tree] = false
    log.value = `樹 ${tree} 換新機器長回來`
    schedule()
  }, DECLARE_REGROW_MS)
}

// 數量不足就吹新的泡泡，不是把舊的搬過去
function reconcile() {
  if (status.value !== 'playing') return
  const missing = DESIRED - units.value.length
  for (let i = 0; i < missing; i++) units.value.push({ key: ++nextKey, name: podName(), tree: null, fx: 'bounce', fresh: true })
  if (missing > 0) {
    playSfx('pop')
    log.value = `島吹出 ${missing} 顆新泡泡`
  }
  schedule()
}

// 把 Pending 的泡泡掛到最空的樹；掛不上就繼續 Pending
function schedule() {
  if (status.value !== 'playing') return
  for (const pod of units.value.filter((u) => u.tree === null)) {
    const free = TREES.filter((t) => placeVerdict(t) === true).sort((a, b) => onTree(a).length - onTree(b).length)[0]
    if (!free) break
    pod.tree = free
    pod.fx = 'bounce'
  }
  if (phase.value === 'declare' && pushes.value >= PUSHES_TO_WIN && running.value === DESIRED) {
    hint.show('又回到 6 / 6 了！', 'good')
    later(() => {
      if (status.value === 'playing') status.value = 'won'
    }, 1200)
  }
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="先手動救小鳥，再交給島自己補"
    :status="status"
    :aha="AHA"
    :timer="timer"
    @start="start"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="island">
      <Meter :value="running" :max="DESIRED" label="在跑的服務" class="island__meter" />

      <div class="sky">
        <template v-if="phase === 'declare'">
          <KChar
            v-for="pod in units.filter((u) => u.tree === null)"
            :key="pod.key"
            id="bubble"
            :size="38"
            fx="ghost"
            label="Pending"
            disabled
            data-test="pending"
          />
        </template>
      </div>

      <div class="grove">
        <div v-for="tree in TREES" :key="tree" class="grove__col">
          <div class="grove__slots">
            <template v-for="unit in onTree(tree)" :key="unit.key">
              <KChar
                v-if="phase === 'declare'"
                id="bubble"
                :size="36"
                :fx="unit.fx"
                :badge="unit.fresh ? '新' : undefined"
                disabled
                data-test="pod"
              />
              <KChar v-else id="bird" :size="32" disabled />
            </template>
          </div>
          <KChar
            id="tree"
            :size="92"
            :fx="shakingTree === tree ? 'shake' : down[tree] ? 'dim' : 'none'"
            :label="`樹 ${tree}`"
            :data-tree="tree"
            class="grove__tree"
            :class="{ 'is-down': down[tree], 'is-flash': flashTree === tree }"
            @tap="tapTree(tree)"
          />
        </div>
      </div>

      <div class="ground">
        <template v-if="phase !== 'declare'">
          <KChar
            v-for="bird in grounded"
            :key="bird.key"
            id="bird"
            :size="40"
            :selected="pickPlace.picked.value === String(bird.key)"
            data-test="ground-bird"
            :class="{ 'is-flash': flashBird }"
            @tap="tapGround(String(bird.key))"
          />
        </template>
        <small v-else-if="phase === 'declare'" class="ground__log">{{ log || '點一棵樹，把它推倒' }}</small>
      </div>
      <small v-if="phase === 'declare'" class="island__note">真實叢集要等幾分鐘才判定樹失聯，這裡加速</small>
    </div>

    <template #controls>
      <button v-if="phase === 'switch'" class="btn btn--primary declare pop-in" data-test="declare" @click="declare">
        <CharacterSprite id="whistle" :size="28" />
        寫下期望：6 個服務
      </button>
    </template>
  </GameShell>
</template>

<style scoped>
.island {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 56px 12px 10px;
}

.sky {
  min-height: 66px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.grove {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.grove__col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.grove__slots {
  height: 46px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.grove__slots :deep(.kchar) {
  min-width: 34px;
}

.grove__tree :deep(.kchar__body) {
  transition: transform 0.4s;
}

.grove__tree.is-down :deep(.kchar__body) {
  transform: rotate(-28deg) translateY(10px);
}

.is-flash :deep(.kchar__body) {
  animation: day01-flash 0.8s ease-in-out infinite;
}

@keyframes day01-flash {
  50% {
    filter: drop-shadow(0 0 6px var(--gold)) drop-shadow(0 0 12px var(--accent));
  }
}

.ground {
  min-height: 64px;
  margin-top: 6px;
  border-top: 4px solid var(--leaf-deep);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.ground__log {
  color: var(--ink);
  font-family: var(--font-display);
}

.island__note {
  margin-top: auto;
  color: var(--ink-soft);
  font-size: 0.7rem;
  text-align: center;
}

.declare {
  width: 100%;
  min-height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
