<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { ChoiceCards, GameShell, HintBubble, KChar, TagChip, useHint, useRounds, useTimeouts, type GameStatus } from '../kit'

// Day 11 後悔捲軸：預測哪些變更會在卷軸（Revision）多一行，壞版本卡住後捲回上一版
const emit = defineEmits<{ complete: [] }>()

interface Change {
  card: string
  addsRevision: boolean
  image?: string
}
interface Revision {
  rev: number
  image: string
}
interface Owl {
  image: string
  count: number
  bad?: boolean
}

const CHANGES: Change[] = [
  { card: 'replicas 2 → 3', addsRevision: false },
  { card: 'image → nginx:1.27', addsRevision: true, image: 'nginx:1.27' },
  { card: 'image → nginx:9.99', addsRevision: true, image: 'nginx:9.99' },
]
const ROUNDS = [...CHANGES.map((c) => c.card), 'rollout undo']
const AHA = '舊副本還健康時，壞版本會卡在半路，不會把服務推垮。rollback 是把卷軸往回捲；回去的版本拿到新編號，舊貓頭鷹的數字被調回來。'

const status = ref<GameStatus>('intro')
const phase = ref<'predict' | 'playing' | 'rollback' | 'done'>('predict')
const history = ref<Revision[]>([{ rev: 1, image: 'nginx:1.25' }])
const owls = ref<Owl[]>([{ image: 'nginx:1.25', count: 2 }])
const poppingBad = ref(false)
const shakeRev = ref<number | null>(null)
const rounds = useRounds(ROUNDS)
const hint = useHint(2600)
const rollbackMisses = ref(0)
const { later } = useTimeouts()

let completed = false

const change = computed(() => CHANGES[rounds.index.value])
const options = computed(() => {
  const n = rounds.index.value + 1
  return [
    { id: `s${n}-yes`, label: '卷軸會多一行' },
    { id: `s${n}-no`, label: '不會' },
  ]
})
const answerId = computed(() => `s${rounds.index.value + 1}-${change.value?.addsRevision ? 'yes' : 'no'}`)
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: ROUNDS.length,
}))
// 卷軸新的在上
const scroll = computed(() => [...history.value].reverse())
const revOf = (owl: Owl) => history.value.find((h) => h.image === owl.image)?.rev

function predict(_id: string, correct: boolean) {
  const step = change.value
  if (phase.value !== 'predict' || !step) return
  rounds.record(correct)
  if (!correct) hint.show(step.addsRevision ? '改 image 就是新版本，多一行' : '卷軸只記泡泡長相，不記數量', 'bad')
  phase.value = 'playing'
  later(() => play(step), correct ? 400 : 1800)
}

function play(step: Change) {
  if (status.value !== 'playing') return
  if (!step.image) {
    owls.value[0]!.count = 3
    playSfx('tap')
    hint.show('貓頭鷹變 3 顆，卷軸沒變', 'info')
    return later(nextStep, 1600)
  }
  history.value.push({ rev: history.value.length + 1, image: step.image })
  const [current] = owls.value.slice(-1)
  if (step.image === 'nginx:9.99') {
    // maxSurge 1、maxUnavailable 0：只多吹 1 顆，拉不到 image 就停住
    owls.value.push({ image: step.image, count: 1, bad: true })
    playSfx('wrong')
    hint.show('拉不到 image，更新卡住了', 'bad', 3000)
    return later(nextStep, 1800)
  }
  // 新版本交給新貓頭鷹，一加一減交替滾動
  owls.value.push({ image: step.image, count: 0 })
  const target = owls.value[owls.value.length - 1]!
  for (let i = 0; i < 3; i++) {
    later(() => {
      target.count++
      if (current) current.count--
      playSfx('pop')
    }, 500 * (i + 1))
  }
  later(() => hint.show('舊貓頭鷹停在 0，沒被刪', 'good'), 1700)
  later(nextStep, 3200)
}

function nextStep() {
  if (status.value !== 'playing') return
  if (rounds.next() && rounds.index.value < CHANGES.length) {
    phase.value = 'predict'
    return
  }
  phase.value = 'rollback'
  hint.show('點卷軸上你要回去的那一行', 'info', 4000)
}

function rollbackTo(rev: number) {
  if (phase.value !== 'rollback') return
  const latest = history.value[history.value.length - 1]!
  if (rev === latest.rev || rev === 1) {
    playSfx('wrong')
    rollbackMisses.value++
    shakeRev.value = rev
    later(() => (shakeRev.value = null), 400)
    hint.show(rev === 1 ? '也能救，但會丟掉 1.27 的更新' : '就是它壞的', 'bad')
    return
  }
  const target = history.value.find((h) => h.rev === rev)!
  phase.value = 'done'
  rounds.record(true)
  playSfx('correct')
  // undo 會把目標那行移到最新並給新編號
  history.value = [...history.value.filter((h) => h.rev !== rev), { rev: latest.rev + 1, image: target.image }]
  poppingBad.value = true
  later(() => {
    owls.value = owls.value.map((o) => (o.bad ? { ...o, count: 0 } : o))
    poppingBad.value = false
    hint.show(`回到 ${target.image}，編號變 rev${latest.rev + 1}`, 'good', 3000)
  }, 400)
  later(() => {
    if (status.value === 'playing') status.value = 'won'
  }, 1800)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="卡住了就捲回上一版"
    :status="status"
    :aha="AHA"
    :progress="progress"
    @start="status = 'playing'"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="scroll paper">
      <KChar id="steward" :size="48" disabled />
      <div class="scroll__lines">
        <small>版本卷軸（Revision）</small>
        <TagChip
          v-for="h in scroll"
          :key="h.rev"
          :text="`rev${h.rev}  ${h.image}`"
          mono
          :color="h.image === 'nginx:9.99' ? 'red' : 'blue'"
          :data-rev="h.rev"
          class="scroll__line"
          :class="{
            'is-pick': phase === 'rollback',
            'is-flash': phase === 'rollback' && rollbackMisses >= 2 && h.image === 'nginx:1.27',
            shake: shakeRev === h.rev,
          }"
          @tap="rollbackTo(h.rev)"
        />
      </div>
    </div>

    <div class="owls">
      <div v-for="(o, i) in owls" :key="o.image" class="owl-row" :class="{ 'is-zero': o.count === 0 }">
        <KChar id="owl" :size="44" :badge="o.count" disabled />
        <small class="owl-row__rev">rev{{ revOf(o) ?? '?' }} · {{ o.image.replace('nginx:', '') }}</small>
        <div class="owl-row__pods">
          <KChar
            v-for="n in o.count"
            :key="`${i}-${n}`"
            id="bubble"
            :size="34"
            :fx="o.bad ? (poppingBad ? 'pop' : 'red') : 'bounce'"
            :label="o.bad ? 'ImagePullBackOff' : undefined"
            disabled
          />
        </div>
      </div>
    </div>

    <template #controls>
      <div v-if="phase === 'predict' && change" class="card">
        <p class="card__title">變更卡：<TagChip :text="change.card" mono color="yellow" class="card__chip" /></p>
        <ChoiceCards :options="options" :answer="answerId" :columns="2" @choose="predict" />
      </div>
      <p v-else-if="phase === 'rollback'" class="card__note">rollout undo：點卷軸上要回去的那一行</p>
      <p v-else class="card__note">部署管家執行中…</p>
    </template>
  </GameShell>
</template>

<style scoped>
.scroll {
  margin: 56px 12px 0;
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.scroll__lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.scroll__line {
  width: 100%;
  text-align: left;
  white-space: pre;
}

.scroll__line.is-pick {
  animation: day11-pulse 1.2s ease-in-out infinite;
}

.owls {
  margin: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.owl-row {
  display: grid;
  grid-template-columns: 48px 76px 1fr;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}

.owl-row.is-zero {
  opacity: 0.55;
}

.owl-row__rev {
  font-size: 0.75rem;
}

.owl-row__pods {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card__title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-display);
}

.card__chip {
  pointer-events: none;
}

.card__note {
  margin: 0;
  min-height: 56px;
  display: grid;
  place-items: center;
  color: var(--ink-soft);
}

.scroll__line.is-flash {
  animation: day11-flash 0.8s ease-in-out infinite;
}

@keyframes day11-flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}

@keyframes day11-pulse {
  50% {
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
}
</style>
