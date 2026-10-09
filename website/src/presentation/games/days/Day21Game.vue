<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { ChoiceCards, GameShell, HintBubble, KChar, TagChip, useHint, useTicker, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 21 存檔大作戰：容器重啟只清空肚子，emptyDir 跟著 Pod 活，Pod 被替換才消失
const emit = defineEmits<{ complete: [] }>()

type Step = 'save' | 'ask-restart' | 'ask-replace' | 'busy'

const SPAWN_MS = 800
const GOAL = 5
const BELLY_MAX = 4
const ASK_AT = 2 // 存到第 2 份先猜重啟會清掉誰
const CRASH_AT = 4 // 存到第 4 份突襲重啟
const OLD_POD = 'upload-7f9c-abcde'
const NEW_POD = 'upload-7f9c-xk2mp'
const FILES = ['cat.jpg', 'menu.pdf', 'log-01', 'song.mp3', 'note.txt', 'map.png', 'log-02', 'cv.doc', 'clip.mp4', 'key.csv']
const SIDECAR_LINES = ['收到，讀得到！', '桶裡又多一份', '這份我也讀到了', '桶快滿了，加油', '五份到齊！']
const AHA = '小鳥（Container）重啟，食物桶（emptyDir）還在；泡泡（Pod）被替換就沒了。要活過泡泡，得放到外面的倉庫（PV）。'

const RESTART_OPTIONS = [
  { id: 'belly', label: '肚子裡的檔案' },
  { id: 'bucket', label: '食物桶裡的檔案' },
  { id: 'both', label: '兩邊一起清空' },
]
const REPLACE_OPTIONS = [
  { id: 'gone', label: '跟著舊泡泡一起消失' },
  { id: 'move', label: '自動搬進新泡泡' },
  { id: 'stay', label: '留在原地等新泡泡' },
]
const WRONG_WHY: Record<string, string> = {
  bucket: '食物桶屬於泡泡，不屬於小鳥',
  both: '重啟的只是小鳥，泡泡沒換',
  move: 'emptyDir 不會搬家',
  stay: '泡泡一破，桶就跟著碎',
}

interface BellyFile {
  seq: number
  name: string
  fx: 'new' | 'lost'
}

const status = ref<GameStatus>('intro')
const step = ref<Step>('save')
const hint = useHint(2200)
const { later, clearAll } = useTimeouts()
const belly = ref<BellyFile[]>([])
const saved = ref<string[]>([])
const lost = ref(0)
const restarts = ref(0)
const podName = ref(OLD_POD)
const birdFx = ref<CharFx>('none')
const bucketFx = ref<CharFx>('none')
const podFx = ref<'none' | 'pop' | 'bounce'>('none')
const sidecarSays = ref('等你放東西進桶')
const misses = ref(0)
let fileSeq = 0
let crashed = false
let crashPending = false
let completed = false

const ticker = useTicker(SPAWN_MS, spawn)
const shown = computed(() => Math.min(saved.value.length, GOAL))
const quiz = computed(() =>
  step.value === 'ask-restart'
    ? { q: '小鳥要重啟了！哪邊會被清空？', options: RESTART_OPTIONS, answer: 'belly' }
    : step.value === 'ask-replace'
      ? { q: '整顆泡泡要被換掉，桶裡的檔案？', options: REPLACE_OPTIONS, answer: 'gone' }
      : null,
)

function spawn() {
  if (status.value !== 'playing' || belly.value.length >= BELLY_MAX) return
  const seq = ++fileSeq
  belly.value.push({ seq, name: FILES[(seq - 1) % FILES.length] as string, fx: 'new' })
}

// 同一個 fx 要重播，先切回 none
function flash(target: typeof birdFx, value: CharFx) {
  target.value = 'none'
  later(() => (target.value = value), 20)
}

function save(file: BellyFile) {
  if (status.value !== 'playing' || step.value !== 'save' || file.fx === 'lost' || saved.value.length >= GOAL) return
  belly.value = belly.value.filter((f) => f.seq !== file.seq)
  saved.value.push(file.name)
  sidecarSays.value = SIDECAR_LINES[Math.min(saved.value.length, GOAL) - 1] as string
  flash(bucketFx, 'bounce')
  playSfx('pop')

  const n = saved.value.length
  if (n === ASK_AT) return askRestart()
  if (n === CRASH_AT && !crashed) return warnCrash()
  if (n >= GOAL && !crashPending) return askReplace()
}

function askRestart() {
  ticker.stop()
  while (belly.value.length < 3) spawn()
  step.value = 'ask-restart'
  misses.value = 0
  birdFx.value = 'red'
  hint.show('先猜猜看，再看結果', 'info')
}

// 第二次重啟不問，給 1.2 秒搶救肚子裡的檔案
function warnCrash() {
  crashed = true
  crashPending = true
  birdFx.value = 'red'
  spawn()
  hint.show('又要重啟了！快搶救肚子', 'bad', 1400)
  later(() => {
    if (status.value !== 'playing' || step.value !== 'save') return
    crashPending = false
    crash()
  }, 1200)
}

// 容器重啟：肚子的檔案劃掉消失，食物桶不動
function crash() {
  step.value = 'busy'
  ticker.stop()
  restarts.value++
  lost.value += belly.value.length
  belly.value = belly.value.map((f) => ({ ...f, fx: 'lost' as const }))
  flash(birdFx, 'shake')
  flash(bucketFx, 'glow')
  playSfx('wrong')
  hint.show(`肚子清空，桶裡 ${shown.value} 份還在`, 'good')
  later(() => {
    if (status.value !== 'playing') return
    belly.value = []
    birdFx.value = 'none'
    if (saved.value.length >= GOAL) return askReplace()
    step.value = 'save'
    spawn()
    ticker.start()
  }, 1300)
}

function askReplace() {
  ticker.stop()
  step.value = 'ask-replace'
  misses.value = 0
  hint.show('滾動更新：這顆泡泡要被替換', 'info')
}

function choose(id: string, correct: boolean) {
  if (status.value !== 'playing') return
  if (!correct) {
    misses.value++
    return hint.show(WRONG_WHY[id] ?? '再想想', 'bad')
  }
  if (step.value === 'ask-restart') return crash()
  replacePod()
}

// 結局：整顆泡泡被換掉，食物桶跟著碎，新泡泡從空桶開始
function replacePod() {
  step.value = 'busy'
  podFx.value = 'pop'
  playSfx('pop')
  later(() => {
    if (status.value !== 'playing') return
    podName.value = NEW_POD
    saved.value = []
    restarts.value = 0
    belly.value = []
    sidecarSays.value = '桶是空的…'
    bucketFx.value = 'dim'
    podFx.value = 'bounce'
    hint.show('新泡泡的食物桶是空的', 'bad', 3000)
    later(() => {
      if (status.value === 'playing') status.value = 'won'
    }, 1800)
  }, 900)
}

function begin() {
  clearAll()
  ticker.stop()
  hint.clear()
  step.value = 'save'
  belly.value = []
  saved.value = []
  lost.value = 0
  restarts.value = 0
  podName.value = OLD_POD
  birdFx.value = 'none'
  bucketFx.value = 'none'
  podFx.value = 'none'
  sidecarSays.value = '等你放東西進桶'
  misses.value = 0
  fileSeq = 0
  crashed = false
  crashPending = false
  status.value = 'playing'
  spawn()
  spawn()
  ticker.start()
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="把資料搬進食物桶保住它"
    :status="status"
    :aha="AHA"
    :progress="{ current: podName === NEW_POD ? GOAL : shown, total: GOAL }"
    lose-text="留在肚子裡的，重啟就清空。點檔案搬進食物桶！"
    @start="begin"
    @retry="begin"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="top">
      <TagChip class="static" :text="`食物桶存了 ${shown} / ${GOAL} 份`" :color="shown >= GOAL ? 'green' : 'yellow'" data-test="bucket" />
      <small v-if="lost" class="top__lost" data-test="lost">重啟弄丟 {{ lost }} 份</small>
    </div>

    <!-- 泡泡外殼用 CSS 畫，內部才放得下兩隻小鳥與檔案 -->
    <div class="pod" :class="{ 'is-popping': podFx === 'pop', 'pop-in': podFx === 'bounce' }">
      <div class="pod__name">
        <code data-test="pod-name">{{ podName }}</code>
        <span class="pod__restarts">RESTARTS <b data-test="restarts">{{ restarts }}</b></span>
      </div>

      <div class="pod__row">
        <div class="pod__col">
          <KChar id="bird" :size="48" :fx="birdFx" label="上傳服務" disabled />
          <KChar id="food-bowl" :size="24" disabled />
        </div>
        <div class="pod__col">
          <KChar id="food-bucket" :size="56" :fx="bucketFx" label="emptyDir" disabled />
          <div class="bucket__files">
            <i v-for="(name, i) in saved.slice(0, GOAL)" :key="i" class="pop-in" :title="name" />
          </div>
        </div>
        <div class="pod__col">
          <span class="say">{{ sidecarSays }}</span>
          <KChar id="bird" :size="40" label="sidecar" disabled />
          <KChar id="food-bowl" :size="24" disabled />
        </div>
      </div>

      <div class="belly" :class="{ 'is-warn': birdFx === 'red' }">
        <small>上傳服務的肚子（容器檔案系統），點檔案搬進桶</small>
        <div class="belly__files">
          <TagChip
            v-for="f in belly"
            :key="f.seq"
            class="pop-in"
            :class="{ 'is-lost': f.fx === 'lost' }"
            :text="f.name"
            :strike="f.fx === 'lost'"
            :color="f.fx === 'lost' ? 'red' : 'blue'"
            mono
            :disabled="step !== 'save'"
            :data-file="f.seq"
            @tap="save(f)"
          />
        </div>
      </div>
    </div>

    <!-- 題目放在舞台內，390x844 第一屏看得到全部選項 -->
    <div v-if="quiz" class="quiz" :class="{ 'is-stuck': misses >= 2 }" :data-answer="quiz.answer">
      <p class="quiz__q">{{ quiz.q }}</p>
      <ChoiceCards :options="quiz.options" :answer="quiz.answer" @choose="choose" />
    </div>
  </GameShell>
</template>

<style scoped>
.static {
  pointer-events: none;
}

.top {
  margin-top: 54px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.top__lost {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--danger);
}

.pod {
  margin: 6px 10px 8px;
  padding: 10px 12px 14px;
  border: 3px solid color-mix(in srgb, var(--sky-deep) 70%, #fff);
  border-radius: 46% / 30%;
  background: radial-gradient(circle at 22% 14%, #fff 0 5%, transparent 6%), color-mix(in srgb, var(--sky) 55%, #fff);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.pod.is-popping {
  animation: burst 0.5s ease-in forwards;
}

@keyframes burst {
  40% {
    transform: scale(1.06);
  }
  100% {
    transform: scale(0.2);
    opacity: 0;
  }
}

.pod__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}

.pod__restarts {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
}

.pod__row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.pod__col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.say {
  max-width: 96px;
  padding: 2px 8px;
  border-radius: var(--radius-md);
  background: var(--paper);
  font-size: 0.72rem;
  text-align: center;
}

.bucket__files {
  display: flex;
  gap: 3px;
  height: 10px;
}

.bucket__files i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--leaf-deep);
}

.belly {
  width: 94%;
  min-height: 104px;
  padding: 4px 6px 8px;
  border: 2px dashed var(--ink-soft);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--cloud) 85%, transparent);
  text-align: center;
  transition: border-color 0.2s;
}

.belly.is-warn {
  border-color: var(--danger);
}

.belly small {
  font-size: 0.7rem;
  color: var(--ink-soft);
}

.belly__files {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 8px;
  margin-top: 6px;
}

.belly__files .is-lost {
  opacity: 0.6;
}

.quiz {
  margin: 0 12px 10px;
}

.quiz__q {
  margin: 0 0 6px;
  text-align: center;
  font-family: var(--font-display);
}

/* 卡關保護：連錯 2 次，正解閃一下 */
.quiz.is-stuck[data-answer='belly'] :deep([data-choice='belly']),
.quiz.is-stuck[data-answer='gone'] :deep([data-choice='gone']) {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}
</style>
