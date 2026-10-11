<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGame } from '@/application/useGame'
import { NICKNAME_MAX_LENGTH, normalizeNickname } from '@/domain/progress'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import AudioToggles from '@/presentation/components/ui/AudioToggles.vue'

const router = useRouter()
const game = useGame()

const returning = computed(() => game.progress.value.nickname !== '')
const editing = ref(!returning.value)
const draft = ref(game.progress.value.nickname)
const canStart = computed(() => normalizeNickname(draft.value).length > 0)
// 以字元計數，emoji 算一個字，與存檔時的截斷規則一致
const draftLength = computed(() => Array.from(draft.value.trim()).length)
const tooLong = computed(() => draftLength.value > NICKNAME_MAX_LENGTH)

// 放在 public/ 的原作插圖，用執行期路徑避免被打包器解析
const ISLAND_ART = 'art/day-29-01.webp'

const FLOATERS = [
  { id: 'bird', top: '20%', left: '8%', size: 54, delay: '0s' },
  { id: 'bubble', top: '14%', left: '74%', size: 60, delay: '0.6s' },
  { id: 'owl', top: '50%', left: '80%', size: 50, delay: '1.1s' },
  { id: 'whistle', top: '55%', left: '4%', size: 44, delay: '1.6s' },
]

const SPARKS = Array.from({ length: 14 }, () => ({
  top: `${Math.random() * 60}%`,
  left: `${Math.random() * 100}%`,
  delay: `${Math.random() * 4}s`,
}))

// 平板以上的滿版雲層：遠景小、淡、慢，近景大、亮、快，x 以 vw 計
const CLOUD_LAYERS = [
  { layer: 'far', duration: 170, clouds: [
    { x: 3, top: 6, w: 120 }, { x: 22, top: 20, w: 150 }, { x: 41, top: 4, w: 110 },
    { x: 58, top: 30, w: 140 }, { x: 74, top: 12, w: 130 }, { x: 90, top: 26, w: 160 },
    { x: 12, top: 40, w: 110 }, { x: 66, top: 46, w: 120 },
  ] },
  { layer: 'mid', duration: 110, clouds: [
    { x: -4, top: 18, w: 230 }, { x: 28, top: 34, w: 200 }, { x: 52, top: 14, w: 260 },
    { x: 80, top: 40, w: 220 }, { x: 8, top: 60, w: 240 }, { x: 70, top: 66, w: 200 },
  ] },
  { layer: 'near', duration: 70, clouds: [
    { x: -10, top: 2, w: 420 }, { x: 62, top: -4, w: 380 },
    { x: -6, top: 78, w: 460 }, { x: 40, top: 86, w: 400 }, { x: 82, top: 74, w: 440 },
  ] },
].flatMap(({ layer, duration, clouds }) =>
  clouds.map((c) => ({
    layer,
    style: {
      '--x': `${c.x}vw`,
      top: `${c.top}%`,
      width: `${c.w}px`,
      animationDuration: `${duration}s`,
      // 依起始位置換算負延遲，動起來的第一格就停在 x 上
      animationDelay: `${(-duration * (c.x * 14.4 + c.w)) / (1440 + c.w)}s`,
    },
  })),
)

function start() {
  if (!canStart.value) return
  game.setNickname(draft.value)
  playSfx('correct')
  void router.push({ name: 'map' })
}

function continueGame() {
  playSfx('tap')
  void router.push({ name: 'map' })
}
</script>

<template>
  <main class="title">
    <div class="sky" aria-hidden="true">
      <div class="cloudscape">
        <span v-for="(c, i) in CLOUD_LAYERS" :key="i" class="puff" :class="`puff--${c.layer}`" :style="c.style" />
      </div>
      <span class="cloud cloud--1" />
      <span class="cloud cloud--2" />
      <span class="cloud cloud--3" />
      <span v-for="(s, i) in SPARKS" :key="i" class="spark" :style="{ top: s.top, left: s.left, animationDelay: s.delay }" />
    </div>

    <AudioToggles class="title__audio" />

    <header class="title__head">
      <p class="title__series">不囉唆圖解 K8s</p>
      <h1 class="title__logo">
        <span class="title__logo-small">歡迎來到</span>
        雲之島冒險
      </h1>
      <p class="title__tagline">30 天闖關 × 角色圖鑑，成為島的統治者</p>
    </header>

    <div class="stage">
      <img class="island" :src="ISLAND_ART" alt="雲之島全景：燈塔、記憶樹、巢樹與泡泡" />
      <CharacterSprite
        v-for="f in FLOATERS"
        :key="f.id"
        :id="f.id"
        :size="f.size"
        class="floater"
        :style="{ top: f.top, left: f.left, animationDelay: f.delay }"
      />
    </div>

    <section class="card paper">
      <template v-if="editing">
        <label for="nickname" class="card__label">旅人，你叫什麼名字？</label>
        <input
          id="nickname"
          v-model="draft"
          class="card__input"
          placeholder="輸入暱稱（最多 12 字）"
          autocomplete="nickname"
          enterkeyhint="go"
          @keyup.enter="start"
        />
        <p class="card__count" :class="{ 'is-over': tooLong }">
          {{ draftLength }} / {{ NICKNAME_MAX_LENGTH }}<template v-if="tooLong">・超過的字不會存</template>
        </p>
        <button class="btn btn--primary card__cta" :disabled="!canStart" data-test="start" @click="start">
          登島出發 ⛵
        </button>
        <button v-if="returning" class="btn btn--ghost card__sub" @click="editing = false">取消</button>
      </template>
      <template v-else>
        <p class="card__welcome">
          歡迎回來，<strong>{{ game.progress.value.nickname }}</strong>
        </p>
        <p class="card__stats">
          <span class="chip">{{ game.title.value }}</span>
          已過關 {{ game.clearedCount.value }}/{{ game.totalDays }}・圖鑑 {{ game.unlockedCount.value }}/{{ game.totalCharacters }}
        </p>
        <button class="btn btn--primary card__cta" data-test="continue" @click="continueGame">繼續冒險 🗺️</button>
        <button class="btn btn--ghost card__sub" @click="editing = true">改暱稱</button>
      </template>
    </section>

    <p class="title__foot">進度會自動存在這台裝置的瀏覽器裡</p>
  </main>
</template>

<style scoped>
.title {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(28px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #a9d6f0 0%, #d6ecf7 45%, #fdf6e7 100%);
}

.sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cloud {
  position: absolute;
  height: 38px;
  border-radius: 999px;
  background: #fff;
  opacity: 0.85;
  filter: blur(1px);
  animation: drift linear infinite;
}

.cloud::before,
.cloud::after {
  content: '';
  position: absolute;
  background: #fff;
  border-radius: 50%;
}

.cloud::before {
  width: 46%;
  height: 160%;
  left: 14%;
  bottom: 20%;
}

.cloud::after {
  width: 34%;
  height: 120%;
  right: 16%;
  bottom: 30%;
}

.cloud--1 {
  width: 130px;
  top: 9%;
  animation-duration: 38s;
}

.cloud--2 {
  width: 90px;
  top: 34%;
  animation-duration: 52s;
  animation-delay: -20s;
  opacity: 0.7;
}

.cloud--3 {
  width: 160px;
  top: 62%;
  animation-duration: 64s;
  animation-delay: -40s;
  opacity: 0.6;
}

@keyframes drift {
  from {
    transform: translateX(-200px);
  }
  to {
    transform: translateX(calc(480px + 200px));
  }
}

.spark {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 8px 2px #fff8d6;
  animation: twinkle 4s ease-in-out infinite;
  opacity: 0;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.4);
  }
  50% {
    opacity: 0.9;
    transform: scale(1);
  }
}

.title__audio {
  position: absolute;
  z-index: 2;
  top: calc(10px + env(safe-area-inset-top));
  right: 10px;
}

.title__audio :deep(.audio-toggle) {
  border-color: rgb(255 255 255 / 0.9);
  background: rgb(255 255 255 / 0.55);
  backdrop-filter: blur(4px);
  font-size: 1.05rem;
  box-shadow: 0 2px 8px rgb(60 90 120 / 0.15);
}

/* 窄螢幕時標頭讓出右上角的開關 */
@media (max-width: 380px) {
  .title {
    padding-top: calc(60px + env(safe-area-inset-top));
  }
}

.title__head {
  position: relative;
  text-align: center;
  animation: pop-in 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
}

.title__series {
  margin: 0;
  display: inline-block;
  padding: 2px 12px;
  border-radius: 999px;
  background: var(--paper);
  border: 2px solid var(--ink-soft);
  font-family: var(--font-display);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
}

.title__logo {
  margin-top: 10px;
  font-size: clamp(2.3rem, 11vw, 3.1rem);
  color: var(--paper);
  letter-spacing: 0.06em;
  -webkit-text-stroke: 1.5px var(--ink);
  paint-order: stroke fill;
  text-shadow:
    0 4px 0 var(--ink),
    0 8px 18px rgb(80 60 40 / 0.25);
}

.title__logo-small {
  display: block;
  font-size: 0.42em;
  color: var(--accent);
  -webkit-text-stroke: 0;
  text-shadow: none;
  letter-spacing: 0.3em;
}

.title__tagline {
  margin: 6px 0 0;
  font-size: 0.9rem;
  color: var(--ink-soft);
}

.stage {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  margin: 8px 0 4px;
}

.island {
  width: 100%;
  height: 100%;
  object-fit: cover;
  -webkit-mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, #000 60%, transparent 100%);
  mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, #000 60%, transparent 100%);
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) rotate(-0.4deg);
  }
  50% {
    transform: translateY(-10px) rotate(0.4deg);
  }
}

.floater {
  position: absolute;
  animation: bob 3s ease-in-out infinite;
  filter: drop-shadow(0 6px 6px rgb(60 40 20 / 0.18));
}

.card {
  position: relative;
  width: 100%;
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: pop-in 0.6s 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
}

.card__label,
.card__welcome {
  font-family: var(--font-display);
  font-size: 1.15rem;
  text-align: center;
  margin: 0;
}

.card__input {
  width: 100%;
  min-height: 52px;
  padding: 0 16px;
  border: 2px solid var(--ink-soft);
  border-radius: var(--radius-md);
  background: #fff;
  font: inherit;
  font-size: 1.1rem;
  text-align: center;
  color: var(--ink);
}

.card__count {
  margin: -6px 0 0;
  text-align: right;
  font-size: 0.75rem;
  color: var(--ink-soft);
}

.card__count.is-over {
  color: var(--danger);
}

.card__input:focus {
  outline: 3px solid var(--accent-soft);
  border-color: var(--accent);
}

.card__stats {
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  color: var(--ink-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.card__cta {
  width: 100%;
  min-height: 54px;
  font-size: 1.2rem;
}

.card__sub {
  align-self: center;
  min-height: 40px;
}

.title__foot {
  position: relative;
  margin: 14px 0 0;
  font-size: 0.75rem;
  color: var(--ink-soft);
}
/* 滿版雲層只在平板以上出現，手機維持原本三朵雲 */
.cloudscape {
  display: none;
}

@media (min-width: 768px) {
  .cloud {
    display: none;
  }

  .cloudscape {
    display: block;
    position: absolute;
    inset: 0;
  }

  /* 多個柔邊圓疊成一朵水彩雲，底部帶一點奶油色 */
  .puff {
    position: absolute;
    left: var(--x);
    aspect-ratio: 5 / 2;
    background:
      radial-gradient(closest-side, #fff 55%, rgb(255 255 255 / 0)) 6% 78% / 34% 62% no-repeat,
      radial-gradient(closest-side, #fff 55%, rgb(255 255 255 / 0)) 30% 30% / 40% 92% no-repeat,
      radial-gradient(closest-side, #fff 55%, rgb(255 255 255 / 0)) 60% 18% / 44% 100% no-repeat,
      radial-gradient(closest-side, #fff 55%, rgb(255 255 255 / 0)) 86% 62% / 32% 70% no-repeat,
      radial-gradient(closest-side, var(--cloud) 60%, rgb(255 248 236 / 0)) 50% 100% / 100% 52% no-repeat;
    animation: drift-wide linear infinite;
    will-change: transform;
  }

  .puff--far {
    opacity: 0.5;
    filter: blur(2px);
  }

  .puff--mid {
    opacity: 0.72;
    filter: blur(1.2px);
  }

  .puff--near {
    opacity: 0.92;
    filter: blur(0.6px) drop-shadow(0 10px 14px rgb(107 79 58 / 0.06));
  }

  .title__head {
    margin-top: 12px;
    isolation: isolate;
  }

  /* 大標題後方一圈淡淡的天空色，近景雲飄過時字仍清楚 */
  .title__head::before {
    content: '';
    position: absolute;
    inset: -24px -72px;
    z-index: -1;
    background: radial-gradient(closest-side, rgb(169 214 240 / 0.7), rgb(169 214 240 / 0.45) 60%, rgb(169 214 240 / 0));
    pointer-events: none;
  }

  .title__tagline {
    font-size: 1rem;
  }

  /* 主圖收窄，左右留出位置給浮動角色 */
  .stage {
    width: min(560px, 100%);
    margin: 4px 0 -36px;
  }

  .floater:nth-of-type(1) {
    top: 10% !important;
    left: -13% !important;
  }

  .floater:nth-of-type(2) {
    top: 2% !important;
    left: 103% !important;
  }

  .floater:nth-of-type(3) {
    top: 56% !important;
    left: 104% !important;
  }

  .floater:nth-of-type(4) {
    top: 62% !important;
    left: -12% !important;
  }

  .card {
    width: min(440px, 100%);
    padding: 24px 28px;
  }

  .title__foot {
    font-size: 0.85rem;
  }
}

@keyframes drift-wide {
  from {
    transform: translateX(calc(-100% - var(--x)));
  }
  to {
    transform: translateX(calc(100vw - var(--x)));
  }
}

@media (min-width: 1024px) {
  .title {
    padding-top: calc(36px + env(safe-area-inset-top));
  }

  .title__logo {
    font-size: clamp(3.1rem, 4.2vw, 4.4rem);
  }

  .title__tagline {
    font-size: 1.05rem;
  }

  /* 主圖隨視窗高度縮放，讓卡片留在第一屏 */
  .stage {
    width: min(760px, 100%, calc((100dvh - 440px) * 1.6));
    min-width: 520px;
    margin: 0 0 -80px;
  }

  .island {
    -webkit-mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, #000 52%, transparent 100%);
    mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, #000 52%, transparent 100%);
  }

  /* 浮動角色移到主圖兩側，讓島本身有呼吸空間 */
  .floater:nth-of-type(1) {
    top: 8% !important;
    left: -16% !important;
  }

  .floater:nth-of-type(2) {
    top: 2% !important;
    left: 106% !important;
  }

  .floater:nth-of-type(3) {
    top: 56% !important;
    left: 110% !important;
  }

  .floater:nth-of-type(4) {
    top: 62% !important;
    left: -20% !important;
  }

  .card {
    width: min(460px, 100%);
  }
}

/* 減少動態時雲停在預設位置，不跑到畫面外 */
@media (min-width: 768px) and (prefers-reduced-motion: reduce) {
  .puff {
    animation: none;
  }
}
</style>
