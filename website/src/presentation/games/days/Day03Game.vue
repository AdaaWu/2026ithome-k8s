<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import { GameShell, HintBubble, KChar, TagChip, useHint, useRounds, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 3 島嶼點點名：看指令選出它查的那一層，最後戳破一顆泡泡看它重生
const emit = defineEmits<{ complete: [] }>()

type Layer = 'island' | 'tree' | 'bubble' | 'bird'

interface Question {
  prompt: string
  command?: boolean
  answer: Layer
  why: string
}

const LAYERS: Array<{ id: Layer; name: string }> = [
  { id: 'island', name: '島' },
  { id: 'tree', name: '樹' },
  { id: 'bubble', name: '泡泡' },
  { id: 'bird', name: '小鳥' },
]
const LAYER_NAME = Object.fromEntries(LAYERS.map((l) => [l.id, l.name])) as Record<Layer, string>

const QUESTIONS: Question[] = [
  { prompt: 'kubectl cluster-info', command: true, answer: 'island', why: '查的是整個叢集' },
  { prompt: 'kubectl get nodes', command: true, answer: 'tree', why: 'Node 就是樹' },
  { prompt: 'kubectl get pods -o wide', command: true, answer: 'bubble', why: 'Pod 就是泡泡' },
  { prompt: '列出泡泡裡每隻小鳥的名字', answer: 'bird', why: '小鳥是 Container' },
  { prompt: 'K8s 排程的最小單位', answer: 'bubble', why: '排程的是整顆 Pod' },
  { prompt: '可以是實體機，也可以是虛擬機', answer: 'tree', why: 'Node 可實體可虛擬' },
  { prompt: '副本數在數的是誰', answer: 'bubble', why: 'replicas 數的是 Pod' },
  { prompt: '壽命最長的一層', answer: 'island', why: '叢集比裡面的都長命' },
]

interface SceneItem {
  key: string
  id: Layer
  cx: number
  cy: number
  size: number
  pod?: string
  flip?: boolean
}

// 以中心點擺位，舞台基準 340×370，由後往前疊
const SCENE: SceneItem[] = [
  { key: 'island', id: 'island', cx: 170, cy: 240, size: 320 },
  { key: 'tree-a', id: 'tree', cx: 104, cy: 163, size: 160 },
  { key: 'tree-b', id: 'tree', cx: 236, cy: 163, size: 160, flip: true },
  { key: 'pod-a', id: 'bubble', cx: 52, cy: 176, size: 74, pod: 'pod-a' },
  { key: 'pod-b', id: 'bubble', cx: 170, cy: 204, size: 90, pod: 'pod-b' },
  { key: 'pod-c', id: 'bubble', cx: 288, cy: 176, size: 74, pod: 'pod-c' },
  { key: 'bird-a', id: 'bird', cx: 52, cy: 186, size: 28, pod: 'pod-a' },
  { key: 'bird-b1', id: 'bird', cx: 155, cy: 215, size: 28, pod: 'pod-b' },
  { key: 'bird-b2', id: 'bird', cx: 185, cy: 215, size: 28, pod: 'pod-b' },
  { key: 'bird-c', id: 'bird', cx: 288, cy: 186, size: 28, pod: 'pod-c' },
]

// KChar 點擊區至少 44px，擺位要用外框尺寸換算
const placeOf = (item: SceneItem) => {
  const box = Math.max(item.size, 44)
  return { left: `${item.cx - box / 2}px`, top: `${item.cy - box / 2}px` }
}

const AHA = '島包樹、樹掛泡泡（Pod）、泡泡（Pod）裝小鳥（Container）。K8s 排程的是整顆泡泡，泡泡破了重吹，島和樹不受影響。'

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

const status = ref<GameStatus>('intro')
const step = ref<'quiz' | 'egg' | 'reborn'>('quiz')
const rounds = useRounds(shuffle(QUESTIONS))
const hint = useHint()

const litLayer = ref<Layer | null>(null)
const shakingButton = ref<Layer | null>(null)
const missCount = ref(0)
const locked = ref(false)

const podNames = reactive<Record<string, string>>({ 'pod-a': 'web-7c4d', 'pod-b': 'web-9f2k', 'pod-c': 'web-3m8x' })
const poppedPod = ref<string | null>(null)
const rebornPod = ref<string | null>(null)

let completed = false
const { later } = useTimeouts()

const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: QUESTIONS.length,
}))

function fxOf(item: SceneItem): CharFx {
  if (item.pod && item.pod === poppedPod.value) return 'pop'
  if (item.pod && item.pod === rebornPod.value) return 'bounce'
  return litLayer.value === item.id ? 'glow' : 'none'
}

function answer(layer: Layer) {
  if (locked.value || step.value !== 'quiz') return
  const question = rounds.current.value

  if (layer === question.answer) {
    rounds.record(missCount.value === 0)
    playSfx('correct')
    hint.clear()
    litLayer.value = layer
    locked.value = true
    later(nextRound, 900)
    return
  }

  // 答錯：按鈕搖晃、提示原因、舞台亮出正確層，玩家直接重答
  missCount.value++
  playSfx('wrong')
  shakingButton.value = layer
  later(() => (shakingButton.value = null), 400)
  litLayer.value = question.answer
  hint.show(`是「${LAYER_NAME[question.answer]}」：${question.why}`, 'bad')
}

function nextRound() {
  if (status.value !== 'playing') return
  litLayer.value = null
  missCount.value = 0
  locked.value = false
  if (!rounds.next()) step.value = 'egg'
}

// 彩蛋：戳破的泡泡原地重生成新名字，島和樹不動
function popPod(pod: string) {
  if (step.value !== 'egg') return
  step.value = 'reborn'
  poppedPod.value = pod
  playSfx('pop')
  later(() => {
    if (status.value !== 'playing') return
    podNames[pod] = `web-${Math.random().toString(36).slice(2, 6)}`
    poppedPod.value = null
    rebornPod.value = pod
    hint.show('新泡泡長回來，島和樹沒動', 'good')
    later(() => {
      if (status.value === 'playing') status.value = 'won'
    }, 1400)
  }, 1000)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="看指令，點出它查的那一層"
    :status="status"
    :aha="AHA"
    :progress="progress"
    @start="status = 'playing'"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="scene">
      <KChar
        v-for="item in SCENE"
        :key="item.key"
        :id="item.id"
        :size="item.size"
        :fx="fxOf(item)"
        :label="item.id === 'bubble' && item.pod ? podNames[item.pod] : undefined"
        :disabled="!(step === 'egg' && item.id === 'bubble')"
        :data-pod="item.id === 'bubble' ? item.pod : undefined"
        class="scene__item"
        :class="{ 'is-flip': item.flip, 'is-tappable': step === 'egg' && item.id === 'bubble' }"
        :style="placeOf(item)"
        @tap="item.pod && popPod(item.pod)"
      />
    </div>

    <div class="question paper">
      <template v-if="step === 'quiz'">
        <small class="question__label">第 {{ rounds.index.value + 1 }} 題：這查的是哪一層？</small>
        <TagChip v-if="rounds.current.value.command" :text="rounds.current.value.prompt" mono color="blue" data-test="question" />
        <p v-else class="question__text" data-test="question">{{ rounds.current.value.prompt }}</p>
      </template>
      <template v-else>
        <small class="question__label">彩蛋</small>
        <p class="question__text">點一顆泡泡，看看誰會受影響</p>
      </template>
    </div>

    <template #controls>
      <div class="answers">
        <button
          v-for="layer in LAYERS"
          :key="layer.id"
          class="btn answers__btn"
          :class="{
            shake: shakingButton === layer.id,
            'is-flash': missCount >= 2 && layer.id === rounds.current.value.answer,
          }"
          :data-layer="layer.id"
          :disabled="step !== 'quiz'"
          @click="answer(layer.id)"
        >
          <CharacterSprite :id="layer.id" :size="30" />
          {{ layer.name }}
        </button>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.scene {
  position: relative;
  flex: none;
  left: 50%;
  width: 340px;
  height: 370px;
  margin: 8px 0 0 -170px;
}

.scene__item {
  position: absolute;
}

/* 題目作答期間舞台只負責顯示 */
.scene__item:not(.is-tappable) {
  pointer-events: none;
}

.scene__item.is-flip :deep(svg) {
  transform: scaleX(-1);
}

.scene__item.is-tappable :deep(.kchar__body) {
  animation: bob 1.6s ease-in-out infinite;
}

.question {
  position: relative;
  margin: auto 12px 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.question__label {
  color: var(--ink-soft);
}

.question__text {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
}

.answers {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.answers__btn {
  min-height: 56px;
}

.answers__btn.is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}

/* 舞台以 340px 為準，窄螢幕等比縮小並收掉多出的高度 */
@media (max-width: 375px) {
  .scene {
    transform: scale(0.82);
    transform-origin: top center;
    margin-bottom: -67px;
  }
}
</style>
