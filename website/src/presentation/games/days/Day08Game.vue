<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import { GameShell, HintBubble, KChar, TagChip, useHint, useRounds, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 8 放大鏡尋寶：照 Selector 圈出貼紙相符的泡泡，名字和大小寫都是陷阱
const emit = defineEmits<{ complete: [] }>()

type Labels = Record<string, string>

const PODS: Array<{ name: string; labels: Labels }> = [
  { name: 'hello-a1', labels: { app: 'hello', env: 'prod' } },
  { name: 'hello-b2', labels: { app: 'hello', env: 'dev' } },
  { name: 'hello-c3', labels: { app: 'hello', env: 'prod', tier: 'frontend' } },
  { name: 'hello-e5', labels: { app: 'Hello', env: 'prod' } },
  { name: 'hello-f6', labels: { app: 'api', env: 'prod' } },
  { name: 'db-h8', labels: { app: 'db', env: 'prod', tier: 'backend' } },
  { name: 'web-i9', labels: { app: 'hello', env: 'prod' } },
  { name: 'db-j0', labels: { app: 'db', env: 'dev', tier: 'backend' } },
]

// 第 2 次照錯先閃正解，第 3 次才失敗
const MAX_TRIES = 3

const SELECTORS: Labels[] = [{ app: 'hello' }, { app: 'hello', env: 'prod' }, { tier: 'backend', env: 'prod' }]

const TRAP_HINT: Record<string, string> = {
  'hello-e5': 'Hello 和 hello 是兩個字串',
  'hello-f6': '名字叫 hello 沒用，貼紙寫的是 api',
}

const AHA = 'K8s 靠貼紙（Label）找人，不靠名字。多個條件要全部符合，差一個大小寫就找不到。'

const formatLabels = (labels: Labels) => Object.entries(labels).map(([k, v]) => `${k}=${v}`)

// 等值比對，大小寫敏感；多個條件是 AND
function firstMismatch(labels: Labels, selector: Labels): string | null {
  const miss = Object.entries(selector).find(([k, v]) => labels[k] !== v)
  return miss ? `${miss[0]}=${miss[1]}` : null
}

const status = ref<GameStatus>('intro')
const rounds = useRounds(SELECTORS)
const hint = useHint(2600)

const selected = ref<string[]>([])
const shaking = ref<string[]>([])
const revealed = ref(false)
const tries = ref(0)

let completed = false
const { later, clearAll } = useTimeouts()

const selector = computed(() => rounds.current.value)
const selectorText = computed(() => formatLabels(selector.value).join(','))
const answer = computed(() => PODS.filter((p) => !firstMismatch(p.labels, selector.value)).map((p) => p.name))
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: SELECTORS.length,
}))

function fxOf(name: string): CharFx {
  if (shaking.value.includes(name)) return 'shake'
  if (revealed.value) return answer.value.includes(name) ? 'glow' : 'dim'
  return 'none'
}

// 卡關保護：連錯 2 次，還沒選到的正解泡泡會閃
const isFlash = (name: string) => tries.value >= 2 && !revealed.value && answer.value.includes(name) && !selected.value.includes(name)

function toggle(name: string) {
  if (status.value !== 'playing' || revealed.value) return
  playSfx('tap')
  selected.value = selected.value.includes(name) ? selected.value.filter((n) => n !== name) : [...selected.value, name]
}

function shine() {
  if (status.value !== 'playing' || revealed.value) return
  const extras = selected.value.filter((n) => !answer.value.includes(n))
  const missed = answer.value.filter((n) => !selected.value.includes(n))

  if (extras.length === 0 && missed.length === 0) {
    rounds.record(tries.value === 0)
    playSfx('correct')
    revealed.value = true
    hint.show('全部照到了！', 'good', 900)
    later(nextRound, 1200)
    return
  }

  tries.value++
  playSfx('wrong')
  if (tries.value >= MAX_TRIES) {
    status.value = 'lost'
    return
  }

  // 多選的搖晃並取消；先解釋陷阱，其次是哪個條件不符，最後才提示漏選
  shaking.value = extras
  later(() => (shaking.value = []), 450)
  selected.value = selected.value.filter((n) => !extras.includes(n))
  const trap = extras.find((n) => TRAP_HINT[n])
  const first = extras[0]
  if (trap) hint.show(TRAP_HINT[trap]!, 'bad')
  else if (first) hint.show(`${first} 不符合 ${firstMismatch(PODS.find((p) => p.name === first)!.labels, selector.value)}`, 'bad')
  else hint.show(`還漏了 ${missed.length} 顆，看貼紙不看名字`, 'bad')
}

function nextRound() {
  if (status.value !== 'playing') return
  revealed.value = false
  selected.value = []
  tries.value = 0
  if (!rounds.next()) status.value = 'won'
}

function retry() {
  clearAll()
  selected.value = []
  shaking.value = []
  revealed.value = false
  tries.value = 0
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
    hint="點出所有符合條件的泡泡"
    :status="status"
    :aha="AHA"
    :progress="progress"
    lose-text="這回合三次都沒照準。逐條比對貼紙，名字不算數，大小寫也要一樣。"
    @start="status = 'playing'"
    @retry="retry"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="lens paper">
      <CharacterSprite id="magnifier" :size="44" />
      <div class="lens__body">
        <small>第 {{ rounds.index.value + 1 }} 回合 Selector</small>
        <TagChip :text="selectorText" mono color="purple" data-test="selector" />
      </div>
    </div>

    <div class="pods">
      <div v-for="pod in PODS" :key="pod.name" class="pod">
        <KChar
          id="bubble"
          :size="52"
          :fx="fxOf(pod.name)"
          :label="pod.name"
          :selected="selected.includes(pod.name)"
          :data-pod="pod.name"
          :class="{ 'is-flash': isFlash(pod.name) }"
          @tap="toggle(pod.name)"
        />
        <code class="pod__labels">
          <span v-for="text in formatLabels(pod.labels)" :key="text">{{ text }}</span>
        </code>
      </div>
    </div>

    <template #controls>
      <button class="btn btn--primary shine" data-test="shine" :disabled="revealed" @click="shine">
        照！（已選 {{ selected.length }} 顆）
      </button>
    </template>
  </GameShell>
</template>

<style scoped>
.lens {
  margin: 60px 12px 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.lens__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  color: var(--ink-soft);
}

.pods {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px 4px;
  padding: 4px 6px 12px;
}

.pod {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.kchar.is-flash :deep(.kchar__body) {
  animation: day08-flash 0.8s ease-in-out infinite;
}

@keyframes day08-flash {
  50% {
    filter: drop-shadow(0 0 6px var(--gold)) drop-shadow(0 0 12px var(--accent));
  }
}

.pod__labels {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.66rem;
  line-height: 1.25;
  color: var(--ink);
}

.shine {
  width: 100%;
  min-height: 52px;
}
</style>
