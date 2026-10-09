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
</style>
