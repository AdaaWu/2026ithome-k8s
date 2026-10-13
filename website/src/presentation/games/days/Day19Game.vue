<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import { GameShell, HintBubble, KChar, TagChip, useHint, useRounds, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 19 便條本改了沒：判斷改 ConfigMap 後要等同步還是重啟
const emit = defineEmits<{ complete: [] }>()

type Key = 'LOG_LEVEL' | 'index.html' | 'nginx.conf'
type Action = 'sync' | 'restartA' | 'restartB'
type PodKey = 'A' | 'B'

const KEYS: Key[] = ['LOG_LEVEL', 'index.html', 'nginx.conf']
const ROUNDS: Key[] = ['index.html', 'LOG_LEVEL', 'nginx.conf']
const OLD: Record<Key, string> = { LOG_LEVEL: 'info', 'index.html': '舊首頁', 'nginx.conf': '舊設定' }
const NEW: Record<Key, string> = { LOG_LEVEL: 'debug', 'index.html': '新首頁', 'nginx.conf': '新設定' }
const BEST: Record<Key, Action> = { 'index.html': 'sync', LOG_LEVEL: 'restartA', 'nginx.conf': 'restartB' }
const AHA = '改 ConfigMap 後，依注入方式決定是否重啟 Pod。環境變數一定要重啟；掛成檔案會同步，但程式有沒有重讀是另一回事。'

const status = ref<GameStatus>('intro')
const rounds = useRounds(ROUNDS)
const hint = useHint(2600)
const restarts = ref(0)
const missCount = ref(0)
const locked = ref(false)
const cm = reactive<Record<Key, string>>({ ...OLD })
// A：環境變數在啟動時拍快照；B：磁碟上的投影檔，Nginx 每次請求讀首頁、只在啟動時讀設定
const podA = reactive({ name: 'hello-a-7d2k', env: OLD.LOG_LEVEL })
const podB = reactive({ name: 'hello-b-4x9p', disk: { ...OLD }, conf: OLD['nginx.conf'] })
const fx = reactive<Record<PodKey, CharFx>>({ A: 'none', B: 'none' })

const { later } = useTimeouts()

let completed = false

const key = computed(() => rounds.current.value)
const focusB = computed<Key>(() => (key.value === 'nginx.conf' ? 'nginx.conf' : 'index.html'))
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: ROUNDS.length,
}))

// 每列狀態：值和便條本一致為綠，舊值為灰
const rowsA = computed(() => [
  { label: '環境變數', value: podA.env },
  { label: '程式在用', value: podA.env },
])
const rowsB = computed(() => {
  const k = focusB.value
  return [
    { label: '磁碟上', value: podB.disk[k] },
    { label: '程式在用', value: k === 'nginx.conf' ? podB.conf : podB.disk[k] },
  ]
})
const fresh = (value: string) => Object.values(NEW).includes(value)

const live = (k: Key) => (k === 'LOG_LEVEL' ? podA.env : k === 'nginx.conf' ? podB.conf : podB.disk[k])

function startRound() {
  cm[key.value] = NEW[key.value]
  hint.show(`便條本改了 ${key.value}`, 'info')
}

// 同一個 fx 要重播，先切回 none
function setFx(pod: PodKey, value: CharFx) {
  fx[pod] = 'none'
  later(() => (fx[pod] = value), 20)
}

// 重啟其實是換一顆新泡泡：新名字、重新讀環境變數與掛載
function restart(pod: PodKey) {
  const suffix = Math.random().toString(36).slice(2, 6)
  if (pod === 'A') Object.assign(podA, { name: `hello-a-${suffix}`, env: cm.LOG_LEVEL })
  else Object.assign(podB, { name: `hello-b-${suffix}`, disk: { ...cm }, conf: cm['nginx.conf'] })
  setFx(pod, 'bounce')
}

function act(action: Action) {
  if (status.value !== 'playing' || locked.value) return
  const k = key.value
  if (action === 'sync') {
    podB.disk = { ...cm }
    playSfx('tap')
  } else {
    restart(action === 'restartA' ? 'A' : 'B')
    restarts.value++
    playSfx('pop')
  }
  if (live(k) === NEW[k]) {
    return pass(action)
  }
  missCount.value++
  playSfx('wrong')
  if (action === 'sync') hint.show(k === 'LOG_LEVEL' ? '環境變數在容器啟動那一刻就決定了' : 'Nginx 只在啟動時讀一次設定', 'bad')
  else {
    setFx(action === 'restartA' ? 'A' : 'B', 'shake')
    hint.show(`這顆泡泡沒用到 ${k}`, 'bad')
  }
}

function pass(action: Action) {
  locked.value = true
  rounds.record(action === BEST[key.value] && missCount.value === 0)
  playSfx('correct')
  hint.show(action === 'restartB' && key.value === 'index.html' ? '過了，但多花一次重啟' : '設定生效了！', 'good')
  later(() => {
    if (status.value !== 'playing') return
    locked.value = false
    missCount.value = 0
    if (!rounds.next()) status.value = 'won'
    else startRound()
  }, 1600)
}

function begin() {
  status.value = 'playing'
  startRound()
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="用最少重啟讓設定生效"
    :status="status"
    :aha="AHA"
    :progress="progress"
    @start="begin"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="note paper">
      <KChar id="notepad" :size="48" disabled />
      <div class="note__keys">
        <div v-for="k in KEYS" :key="k" class="note__row" :class="{ 'is-focus': k === key && status === 'playing' }">
          <code>{{ k }}</code>
          <TagChip class="static" :text="cm[k]" :color="fresh(cm[k]) ? 'yellow' : 'gray'" />
        </div>
      </div>
    </div>

    <div class="pods">
      <div v-for="pod in (['A', 'B'] as PodKey[])" :key="pod" class="pod">
        <div class="pod__body">
          <KChar id="bubble" :size="96" :fx="fx[pod]" :label="pod === 'A' ? podA.name : podB.name" disabled />
          <CharacterSprite v-if="pod === 'B'" class="pod__bowl" id="food-bowl" :size="26" />
        </div>
        <small class="pod__how">{{ pod === 'A' ? '環境變數注入 LOG_LEVEL' : '掛成檔案 index.html、nginx.conf' }}</small>
        <TagChip
          v-for="row in pod === 'A' ? rowsA : rowsB"
          :key="row.label"
          class="static"
          :text="`${row.label}：${row.value}`"
          :color="fresh(row.value) ? 'green' : 'gray'"
        />
      </div>
    </div>

    <p class="count">重啟 {{ restarts }} 次</p>

    <template #controls>
      <div class="actions">
        <button
          class="btn actions__wide"
          :class="{ 'is-flash': missCount >= 2 && BEST[key] === 'sync' }"
          data-action="sync"
          :disabled="status !== 'playing'"
          @click="act('sync')"
        >
          等 kubelet 同步（快轉 60 秒）
        </button>
        <button
          v-for="pod in (['A', 'B'] as PodKey[])"
          :key="pod"
          class="btn"
          :class="{ 'is-flash': missCount >= 2 && BEST[key] === `restart${pod}` }"
          :data-action="`restart${pod}`"
          :disabled="status !== 'playing'"
          @click="act(`restart${pod}`)"
        >
          重啟 Pod {{ pod }}
        </button>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.static {
  pointer-events: none;
}

.note {
  margin: 58px 10px 0;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.note__keys {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.note__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}

.note__row.is-focus {
  background: var(--accent-soft);
}

.pods {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: 10px 8px 0;
}

.pod {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.pod__body {
  position: relative;
}

.pod__bowl {
  position: absolute;
  right: 0;
  bottom: 22px;
  pointer-events: none;
}

.pod__how {
  font-size: 0.72rem;
  color: var(--ink-soft);
  text-align: center;
}

.count {
  margin: auto 0 10px;
  text-align: center;
  font-family: var(--font-display);
}

.actions {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.actions .btn {
  min-height: 48px;
}

.actions__wide {
  grid-column: 1 / -1;
}

.is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--gold);
    border-color: var(--accent);
  }
}
</style>
