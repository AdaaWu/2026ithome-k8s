<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { ChoiceCards, GameShell, HintBubble, KChar, TagChip, useHint, usePickPlace, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 22 借用單配對：PVC 綁最小夠用的 PV、Pod 指向 PVC、刪 PVC 後看回收策略
const emit = defineEmits<{ complete: [] }>()

type SlipId = 'db' | 'log' | 'cache'
type PvId = 'a' | 'b' | 'c' | 'd'

const SLIPS: Array<{ id: SlipId; need: number }> = [
  { id: 'db', need: 2 },
  { id: 'log', need: 4 },
  { id: 'cache', need: 1 },
]
const PVS: Array<{ id: PvId; size: number; policy: 'Retain' | 'Delete' }> = [
  { id: 'a', size: 1, policy: 'Delete' },
  { id: 'b', size: 5, policy: 'Retain' },
  { id: 'c', size: 10, policy: 'Delete' },
  { id: 'd', size: 2, policy: 'Retain' },
]
const OPTIONS = [
  { id: 'released', label: '留著資料，狀態變 Released' },
  { id: 'deleted', label: '跟著一起被刪掉' },
  { id: 'rebind', label: '馬上借給下一張借用單' },
]
const WRONG_WHY: Record<string, string> = { deleted: '那是 Delete 策略才會發生', rebind: 'Released 不會自動再借出' }
const AHA = '泡泡（Pod）指的是借用單（PVC），不是倉庫（PV）。借用單綁上倉庫是一對一；刪了借用單，倉庫留不留看回收策略。'

const status = ref<GameStatus>('intro')
const step = ref<'bind' | 'point' | 'reclaim' | 'done'>('bind')
const hint = useHint(2600)
const bindings = reactive<Partial<Record<SlipId, PvId>>>({})
const pvFx = reactive<Partial<Record<PvId, CharFx>>>({})
const slipFx = ref<CharFx>('none')
const streak = ref(0)
const pointMiss = ref(0)
// 段落切換的空窗期鎖輸入，避免誤觸錯誤提示
const locked = ref(false)

const boundTo = (pv: PvId) => (Object.keys(bindings) as SlipId[]).find((s) => bindings[s] === pv)
const needOf = (slip: SlipId) => SLIPS.find((s) => s.id === slip)?.need ?? 0
// 控制器在還沒綁定、容量夠用的倉庫裡挑最小的
const bestFor = (slip: SlipId) =>
  PVS.filter((p) => !boundTo(p.id) && p.size >= needOf(slip)).sort((x, y) => x.size - y.size)[0]?.id

const pp = usePickPlace<SlipId, PvId>({
  canPlace: (slip, pv) => {
    if (boundTo(pv)) return '一對一，借走就不能再借'
    if ((PVS.find((p) => p.id === pv)?.size ?? 0) < needOf(slip)) return '倉庫比需求小'
    return bestFor(slip) === pv || '控制器會挑最小但夠用的那座'
  },
})

const { later } = useTimeouts()
let completed = false

const flashPv = computed(() => (streak.value >= 2 && pp.picked.value ? bestFor(pp.picked.value) : null))
const statusOf = (pv: PvId) => (step.value === 'done' && pv === 'd' ? 'Released' : boundTo(pv) ? 'Bound' : 'Available')

// 同一個 fx 要重播，先切回 none
function shakePv(pv: PvId) {
  pvFx[pv] = 'none'
  later(() => (pvFx[pv] = 'shake'), 20)
}

function goTo(next: typeof step.value, ms: number) {
  locked.value = true
  later(() => {
    if (status.value !== 'playing') return
    step.value = next
    locked.value = false
  }, ms)
}

function missPoint() {
  pointMiss.value++
  playSfx('wrong')
}

function tapSlip(slip: SlipId) {
  if (locked.value || status.value !== 'playing') return
  if (step.value === 'bind') {
    if (bindings[slip]) return
    pp.pick(slip)
    playSfx('tap')
    return
  }
  if (step.value !== 'point') return
  if (slip !== 'db') {
    missPoint()
    return hint.show('這顆是 db 的泡泡，要寫 db 那張', 'bad')
  }
  slipFx.value = 'glow'
  playSfx('correct')
  hint.show('對！泡泡只認借用單的名字', 'good')
  goTo('reclaim', 1200)
}

function tapPv(pv: PvId) {
  if (locked.value || status.value !== 'playing') return
  if (step.value === 'point') {
    shakePv(pv)
    missPoint()
    return hint.show('泡泡指的是借用單，不是倉庫', 'bad')
  }
  if (step.value !== 'bind') return
  const slip = pp.picked.value
  const result = pp.place(pv)
  if (!slip) return hint.show('先點一張借用單', 'info')
  if (!result.ok) {
    // 被拒絕的借用單退回，重新點選
    pp.cancel()
    streak.value++
    shakePv(pv)
    playSfx('wrong')
    return hint.show(result.reason, 'bad')
  }
  bindings[slip] = pv
  streak.value = 0
  playSfx('correct')
  if (Object.keys(bindings).length === SLIPS.length) {
    hint.show('全部綁好了！', 'good')
    goTo('point', 1000)
  }
}

function choose(id: string, correct: boolean) {
  if (status.value !== 'playing' || step.value !== 'reclaim') return
  if (!correct) return hint.show(WRONG_WHY[id] ?? '再想想 Retain 的意思', 'bad')
  step.value = 'done'
  slipFx.value = 'pop'
  hint.show('PV-d 變成 Released，資料還在', 'good')
  later(() => {
    if (status.value === 'playing') status.value = 'won'
  }, 2000)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell hint="幫借用單找最剛好的倉庫" :status="status" :aha="AHA" @start="status = 'playing'" @finish="finish">
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="slips">
      <div v-for="s in SLIPS" :key="s.id" class="slip">
        <KChar
          id="borrow-slip"
          :size="52"
          :data-slip="s.id"
          :fx="s.id === 'db' ? slipFx : 'none'"
          :class="{ 'is-flash': step === 'point' && pointMiss >= 2 && s.id === 'db' }"
          :selected="pp.picked.value === s.id"
          :disabled="step === 'reclaim' || step === 'done' || (step === 'bind' && !!bindings[s.id])"
          @tap="tapSlip(s.id)"
        />
        <TagChip class="static" :text="`${s.id} 要 ${s.need}Gi`" color="blue" />
        <small v-if="bindings[s.id] && !(step === 'done' && s.id === 'db')" class="slip__bound" :data-test="`bound-${s.id}`">綁定 PV-{{ bindings[s.id] }}</small>
      </div>
    </div>

    <div v-if="step === 'point'" class="pod pop-in">
      <KChar id="bubble" :size="72" label="db 的泡泡" disabled />
      <p class="pod__ask">它的 YAML 要寫誰？點一下</p>
    </div>

    <div class="pvs">
      <div v-for="p in PVS" :key="p.id" class="pv" :class="{ 'is-flash': flashPv === p.id }">
        <KChar
          id="warehouse"
          :size="60"
          :data-pv="p.id"
          :fx="pvFx[p.id] ?? 'none'"
          :label="`PV-${p.id} ${p.size}Gi`"
          :disabled="step === 'reclaim' || step === 'done'"
          @tap="tapPv(p.id)"
        />
        <div class="pv__tags">
          <TagChip class="static" :text="p.policy" color="gray" />
          <TagChip class="static" :text="statusOf(p.id)" :color="statusOf(p.id) === 'Bound' ? 'green' : statusOf(p.id) === 'Released' ? 'yellow' : 'gray'" />
        </div>
      </div>
    </div>

    <!-- 結尾題放在舞台內，390x844 第一屏看得到全部選項 -->
    <div v-if="step === 'reclaim' || step === 'done'" class="quiz">
      <p class="quiz__q">刪掉 db 的借用單後，PV-d（Retain）會？</p>
      <ChoiceCards :options="OPTIONS" answer="released" @choose="choose" />
    </div>
  </GameShell>
</template>

<style scoped>
.static {
  pointer-events: none;
}

.slips {
  margin-top: 58px;
  display: flex;
  justify-content: space-around;
}

.slip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.slip__bound {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--leaf-deep);
}

.pod {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}

.pod__ask {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.95rem;
}

.pvs {
  margin: auto 8px 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.pv {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
}

.pv__tags {
  display: flex;
  gap: 4px;
}

.pv__tags :deep(.tag) {
  min-height: 26px;
  padding: 2px 8px;
  font-size: 0.72rem;
}

.is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--gold);
  }
}

.quiz {
  margin: 0 10px 10px;
}

.quiz__q {
  margin: 0 0 8px;
  text-align: center;
  font-family: var(--font-display);
}
</style>
