<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { useGame } from '@/application/useGame'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import { ChoiceCards, GameShell, HintBubble, KChar, useCountdown, useHint, useRounds, useTimeouts, type CharFx, type CharacterId, type GameStatus } from '../kit'

// Day 30 雲之島值班夜：五個事故總複習，解一題就有角色跳上合照台，最後全員結業合照
const emit = defineEmits<{ complete: [] }>()

interface Incident {
  prompt: string
  scene: Array<{ id: CharacterId; fx?: CharFx; label?: string; badge?: number }>
  options: Array<{ id: string; label: string; sub?: string }>
  answer: string
  reason: string
  cast: CharacterId[]
}

const INCIDENTS: Incident[] = [
  {
    prompt: '泡泡一直重啟，RESTARTS 8，先查什麼？',
    scene: [{ id: 'bubble', fx: 'red', label: 'CrashLoopBackOff', badge: 8 }, { id: 'magnifier' }],
    options: [
      { id: 'previous', label: 'kubectl logs --previous' },
      { id: 'delete', label: 'kubectl delete pod' },
      { id: 'rebuild', label: '重建整座島' },
    ],
    answer: 'previous',
    reason: '加 --previous 才看得到上一輪怎麼死的',
    cast: ['bubble', 'magnifier'],
  },
  {
    prompt: '資料庫只該給島內用，卻開了 LoadBalancer',
    scene: [{ id: 'bubble', label: 'db' }, { id: 'totem-dock', fx: 'red', label: 'LoadBalancer' }],
    options: [
      { id: 'nodeport', label: '改成 NodePort' },
      { id: 'clusterip', label: '改成 ClusterIP' },
      { id: 'keep', label: '維持現狀' },
    ],
    answer: 'clusterip',
    reason: '只給島內用，ClusterIP 就夠，暴露越少越好',
    cast: ['totem-inner', 'totem-dock'],
  },
  {
    prompt: '新版推一半卡住，一顆紅泡泡',
    scene: [{ id: 'steward' }, { id: 'bubble', label: 'v1' }, { id: 'bubble', fx: 'red', label: 'v2' }],
    options: [
      { id: 'delete-rs', label: '把舊的 ReplicaSet 刪掉' },
      { id: 'wait', label: '等它自己好' },
      { id: 'undo', label: 'kubectl rollout undo' },
    ],
    answer: 'undo',
    reason: '舊 ReplicaSet 還留著，undo 就切回去',
    cast: ['steward', 'owl'],
  },
  {
    prompt: '資料庫泡泡重建後，資料要還在',
    scene: [{ id: 'bubble', fx: 'ghost', label: 'db（重建中）' }, { id: 'warehouse', fx: 'dim' }],
    options: [
      { id: 'pvc', label: '掛 PVC，資料放倉庫' },
      { id: 'emptydir', label: '放 emptyDir' },
      { id: 'container', label: '寫在容器裡' },
    ],
    answer: 'pvc',
    reason: 'PVC 借倉庫，泡泡重建資料還在',
    cast: ['borrow-slip', 'warehouse'],
  },
  {
    prompt: '尖峰時服務變慢，前端一直被重啟',
    scene: [{ id: 'bubble', fx: 'slow', label: 'web' }, { id: 'alive-bell', fx: 'shake' }, { id: 'ready-flag' }],
    options: [
      { id: 'stricter', label: 'Liveness 再調嚴格' },
      { id: 'readiness', label: '資料庫檢查移到 Readiness', sub: 'Liveness 放寬，只看程式本身' },
      { id: 'off', label: '關掉所有探針' },
    ],
    answer: 'readiness',
    reason: '外部依賴交給 Readiness，Liveness 只看自己',
    cast: ['alive-bell', 'ready-flag'],
  },
]

const FINALE: CharacterId[] = ['lighthouse', 'memory-tree', 'tree-picker', 'patrol-captain', 'gatekeeper', 'hpa-knob', 'numbered-keeper', 'whistle', 'island']
const ALL_CAST = [...INCIDENTS.flatMap((i) => i.cast), ...FINALE]

const QUESTION_SEC = 20
const EXTRA_SEC = 10
const LIVES = 3

const AHA = '你不再記哪台跑什麼，島替你記。提交期望狀態、控制器持續調和、再從觀測結果修正設定，這就是 Kubernetes。'

const { progress: save } = useGame()
const nickname = computed(() => save.value.nickname || '你')
const winTitle = computed(() => `${nickname.value}，值班結業！`)

const status = ref<GameStatus>('intro')
const rounds = useRounds(INCIDENTS)
const hint = useHint(2600)
const countdown = useCountdown(QUESTION_SEC, { onExpire: expire })

const lives = ref(LIVES)
const timerTotal = ref(QUESTION_SEC)
const extended = ref(false)
const reveal = ref<{ ok: boolean; title: string } | null>(null)
const onStage = ref<CharacterId[]>([])
const finale = ref(false)

const { later: schedule, clearAll } = useTimeouts()
// 延遲回呼只在本局進行中才生效
const later = (fn: () => void, ms: number) =>
  schedule(() => {
    if (status.value === 'playing') fn()
  }, ms)
let completed = false

const incident = computed(() => rounds.current.value)
const correctLabel = computed(() => incident.value.options.find((o) => o.id === incident.value.answer)!.label)
const solved = computed(() => rounds.results.value.filter((r) => r === 'ok').length)
const timer = computed(() => (finale.value ? undefined : { remaining: countdown.remaining.value, total: timerTotal.value }))
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: INCIDENTS.length,
}))

function addToPhoto(id: CharacterId) {
  if (!onStage.value.includes(id)) onStage.value.push(id)
}

function startQuestion() {
  timerTotal.value = QUESTION_SEC
  extended.value = false
  countdown.reset(QUESTION_SEC)
  countdown.start()
}

function start() {
  status.value = 'playing'
  startQuestion()
}

// 第一次時間到先延長，第二次才算失誤
function expire() {
  if (!extended.value) {
    extended.value = true
    timerTotal.value = EXTRA_SEC
    countdown.reset(EXTRA_SEC)
    countdown.start()
    hint.show(`多給你 ${EXTRA_SEC} 秒，慢慢想`, 'info')
    return
  }
  fail('時間到')
}

function choose(_id: string, correct: boolean) {
  if (reveal.value || status.value !== 'playing') return
  countdown.pause()
  if (!correct) {
    fail('答錯了')
    return
  }
  rounds.record(true)
  reveal.value = { ok: true, title: '處理完成！' }
  incident.value.cast.forEach((id, i) => later(() => addToPhoto(id), i * 250))
}

function fail(title: string) {
  countdown.pause()
  rounds.record(false)
  playSfx('wrong')
  lives.value--
  if (lives.value <= 0) {
    status.value = 'lost'
    return
  }
  reveal.value = { ok: false, title }
}

function next() {
  if (status.value !== 'playing') return
  reveal.value = null
  if (rounds.next()) {
    startQuestion()
    return
  }
  // 全員合照：沒上台的角色也一起跳上來
  finale.value = true
  hint.show('全員到齊，結業合照！', 'good', 3000)
  playSfx('win')
  const rest = ALL_CAST.filter((id) => !onStage.value.includes(id))
  rest.forEach((id, i) => later(() => addToPhoto(id), i * 120))
  later(() => (status.value = 'won'), rest.length * 120 + 1200)
}

function retry() {
  clearAll()
  countdown.pause()
  hint.clear()
  finale.value = false
  rounds.reset()
  lives.value = LIVES
  reveal.value = null
  onStage.value = []
  hint.clear()
  status.value = 'playing'
  startQuestion()
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="連續處理五個島嶼事故"
    :status="status"
    :aha="AHA"
    :win-title="winTitle"
    :timer="timer"
    :progress="progress"
    lose-text="三條命用完了。每題的正解都看過一次，再值一次班就會了。"
    @start="start"
    @retry="retry"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="top">
      <span class="lives" data-test="lives">命 {{ '♥'.repeat(lives) }}{{ '♡'.repeat(LIVES - lives) }} {{ lives }}</span>
      <span v-if="!finale" class="top__no">事故 {{ rounds.index.value + 1 }}/{{ INCIDENTS.length }}</span>
    </div>

    <template v-if="!finale">
      <div class="incident">
        <KChar
          v-for="(c, i) in incident.scene"
          :key="`${rounds.index.value}-${i}`"
          :id="c.id"
          :size="48"
          :fx="c.fx"
          :label="c.label"
          :badge="c.badge"
          disabled
        />
      </div>
      <p class="prompt paper">{{ incident.prompt }}</p>

      <!-- 選項放在舞台內，390x844 第一屏就看得到全部選項 -->
      <div v-if="reveal" class="reveal paper" :class="reveal.ok ? 'is-ok' : 'is-bad'" data-test="reveal">
        <strong>{{ reveal.title }}</strong>
        <p>正解：{{ correctLabel }}<br />{{ incident.reason }}</p>
        <button class="btn btn--primary" data-test="next" @click="next">
          {{ rounds.isLast.value ? '收工，合照去 ▶' : '下一題 ▶' }}
        </button>
      </div>
      <ChoiceCards v-else class="choices" :options="incident.options" :answer="incident.answer" @choose="choose" />
    </template>

    <div class="photo" :class="{ 'is-finale': finale }">
      <small class="photo__title">{{ finale ? '雲之島全員合照' : '合照台' }}</small>
      <div class="photo__crowd" data-test="photo">
        <span v-for="id in onStage" :key="id" class="photo__member pop-in">
          <CharacterSprite :id="id" :size="finale ? 38 : 30" />
        </span>
      </div>
    </div>

    <div v-if="finale" class="cert paper pop-in" data-test="cert">
      <small class="cert__eyebrow">雲之島結業證書</small>
      <strong class="cert__name">{{ nickname }}</strong>
      <p class="cert__line">完成 30 天 K8s 冒險，值完最後一夜班</p>
      <p class="cert__line">事故處理 {{ solved }}/{{ INCIDENTS.length }}・剩餘命 {{ lives }}</p>
    </div>

  </GameShell>
</template>

<style scoped>
.top {
  margin: 8px 12px 0;
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.lives {
  color: var(--danger);
  font-weight: 700;
}

.top__no {
  color: var(--ink-soft);
}

.incident {
  margin: 4px 10px 0;
  min-height: 84px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 14px;
}

.prompt {
  margin: 4px 12px;
  padding: 8px 12px;
  font-family: var(--font-display);
  font-size: 1.05rem;
  text-align: center;
}

.photo {
  margin: auto 10px 10px;
  padding: 4px 8px 6px;
  min-height: 64px;
  border: 2px dashed var(--bark);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--leaf) 22%, var(--cloud));
  text-align: center;
}

.photo.is-finale {
  margin: 48px 10px 12px;
  border-style: solid;
  border-color: var(--gold);
  box-shadow: 0 0 18px var(--gold);
}

.photo__title {
  color: var(--ink-soft);
}

.photo__crowd {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px 4px;
}

.photo__member {
  display: inline-flex;
}

.cert {
  margin: 0 16px auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: 3px double var(--gold);
  text-align: center;
  animation-delay: 1.2s;
  animation-fill-mode: both;
}

.cert__eyebrow {
  color: var(--ink-soft);
  letter-spacing: 0.2em;
}

.cert__name {
  font-family: var(--font-display);
  font-size: 1.6rem;
  color: var(--accent);
}

.cert__line {
  margin: 0;
  font-size: 0.9rem;
}

.choices,
.reveal {
  width: auto;
  margin: 4px 12px 8px;
}

.reveal {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reveal p {
  margin: 0;
  font-size: 0.9rem;
}

.reveal.is-ok strong {
  color: var(--leaf-deep);
}

.reveal.is-bad strong {
  color: var(--danger);
}
</style>
