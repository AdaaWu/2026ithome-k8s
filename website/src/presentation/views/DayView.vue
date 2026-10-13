<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref, shallowRef, watch } from 'vue'
import { useGame } from '@/application/useGame'
import { CHARACTERS } from '@/data/characters'
import { LEVELS } from '@/data/levels'
import { TOTAL_DAYS, actOfDay } from '@/domain/level'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import BriefingCard from '@/presentation/components/ui/BriefingCard.vue'
import ConfettiBurst from '@/presentation/components/ui/ConfettiBurst.vue'
import TopBar from '@/presentation/components/ui/TopBar.vue'
import { GAME_PAUSED } from '@/presentation/games/kit'
import { hasCustomGame, resolveDayGame } from '@/presentation/games/registry'

type Phase = 'intro' | 'play' | 'clear'

const props = defineProps<{ day: number }>()
const game = useGame()

const level = computed(() => LEVELS.find((l) => l.day === props.day))
const act = computed(() => actOfDay(props.day))
const cast = computed(() => CHARACTERS.filter((c) => level.value?.characters.includes(c.id)))
/** 每幕第一關才顯示章節開場 */
const isActOpening = computed(() => act.value?.days[0] === props.day)
/** 本幕登場角色，依 debutDay 落在幕的天數區間推導，依登場日排序 */
const actDebuts = computed(() => {
  const range = act.value?.days
  if (!range) return []
  return CHARACTERS.filter((c) => c.debutDay >= range[0] && c.debutDay <= range[1])
    .sort((a, b) => a.debutDay - b.debutDay)
    .map((c) => c.name)
})
/** 有計時或倒數的關卡，重看簡報時提醒遊戲已暫停 */
const TIMED_DAYS = new Set([1, 5, 9, 14, 16, 21, 24, 30])
const phase = ref<Phase>('intro')
const briefingOpen = ref(false)
// 簡報開著時小遊戲的計時、倒數與延遲事件都暫停
provide(GAME_PAUSED, briefingOpen)
const gameComponent = shallowRef(resolveDayGame(props.day))
/** 每次重玩換新 key，讓小遊戲元件重新掛載 */
const runId = ref(0)
const wasClearedBefore = ref(false)

watch(
  () => props.day,
  (day) => {
    phase.value = 'intro'
    briefingOpen.value = false
    gameComponent.value = resolveDayGame(day)
  },
)

function startGame() {
  playSfx('tap')
  runId.value++
  briefingOpen.value = false
  phase.value = 'play'
}

function openBriefing() {
  playSfx('tap')
  briefingOpen.value = true
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && briefingOpen.value) briefingOpen.value = false
}

watch(briefingOpen, (open) => {
  if (open) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function onComplete() {
  if (phase.value !== 'play') return
  wasClearedBefore.value = game.isDayCleared(props.day)
  game.clearDay(props.day)
  playSfx('win')
  phase.value = 'clear'
}

const nextDay = computed(() => (props.day < TOTAL_DAYS ? props.day + 1 : null))
</script>

<template>
  <div v-if="level" class="day">
    <TopBar :title="`Day ${level.day}`" back="/map" />

    <!-- 開場 -->
    <section v-if="phase === 'intro'" class="page intro">
      <p class="intro__act">{{ act?.name }}</p>
      <h2 class="intro__title">{{ level.title }}</h2>

      <section v-if="act && isActOpening" class="chapter" data-test="chapter-opening">
        <p class="chapter__label">本章開場</p>
        <dl class="chapter__rows">
          <div>
            <dt>本章目標</dt>
            <dd>{{ act.goal }}</dd>
          </div>
          <div>
            <dt>蓋完你會有</dt>
            <dd>{{ act.result }}</dd>
          </div>
          <div>
            <dt>會遇到</dt>
            <dd>{{ actDebuts.length ? actDebuts.join('、') : '全員回場' }}</dd>
          </div>
        </dl>
      </section>

      <BriefingCard :level="level" class="mission">
        <button class="btn btn--primary mission__go" data-test="start-game" @click="startGame">
          {{ game.isDayCleared(level.day) ? '再玩一次' : '開始任務' }} ▶
        </button>
      </BriefingCard>

      <!-- 桌機收成左欄，手機維持原本的上下順序 -->
      <div class="intro__aside">
        <figure class="intro__art paper">
          <img :src="level.image" :alt="level.title" />
        </figure>
        <p class="intro__story">{{ level.intro }}</p>

        <div class="intro__cast">
          <div v-for="c in cast" :key="c.id" class="intro__actor">
            <CharacterSprite :id="c.id" :size="56" bob />
            <small>{{ c.name }}</small>
          </div>
        </div>
      </div>
    </section>

    <!-- 遊戲中 -->
    <section v-else-if="phase === 'play'" class="page play">
      <div class="play__head">
        <h2>{{ level.gameTitle }}</h2>
        <p>{{ level.gameHint }}</p>
        <button class="play__brief" data-test="briefing-open" @click="openBriefing">看簡報</button>
      </div>
      <div class="play__stage">
        <component :is="gameComponent" :key="runId" :character-ids="hasCustomGame(level.day) ? undefined : level.characters" @complete="onComplete" />
      </div>

      <!-- 簡報彈窗掛到 body，遊戲元件留在原處不卸載 -->
      <Teleport to="body">
        <div v-if="briefingOpen" class="brief-overlay" data-test="briefing-dialog" @click.self="briefingOpen = false">
          <div class="brief-dialog" role="dialog" aria-modal="true" aria-label="任務簡報">
            <BriefingCard :level="level">
              <p v-if="TIMED_DAYS.has(level.day)" class="brief-dialog__note">看簡報時遊戲暫停，回到遊戲後繼續</p>
              <button class="btn btn--primary brief-dialog__close" data-test="briefing-close" @click="briefingOpen = false">回到遊戲</button>
            </BriefingCard>
          </div>
        </div>
      </Teleport>
    </section>

    <!-- 過關 -->
    <section v-else class="page clear">
      <ConfettiBurst />
      <div class="clear__badge pop-in">
        <span>DAY</span>
        <b>{{ level.day }}</b>
        <span>CLEAR!</span>
      </div>
      <div class="clear__card paper">
        <p class="clear__label">帶走一句話</p>
        <p class="clear__takeaway" data-test="takeaway">{{ level.takeaway }}</p>
      </div>
      <p v-if="!wasClearedBefore" class="clear__progress">
        關卡進度 {{ game.clearedCount.value }} / {{ game.totalDays }}
      </p>
      <p v-if="game.unlockedCount.value < game.totalCharacters" class="clear__codex-tip" data-test="codex-tip">
        <template v-if="game.clearedCount.value === game.totalDays">
          {{ game.totalDays }} 關全破！<RouterLink to="/codex">圖鑑</RouterLink>還差 {{ game.totalCharacters - game.unlockedCount.value }} 位角色，猜完就能登基
        </template>
        <template v-else>今天的角色都能在 <RouterLink to="/codex">圖鑑</RouterLink> 裡猜猜看，答對就會變彩色喔</template>
      </p>
      <div class="clear__actions">
        <RouterLink v-if="game.isRuler.value" to="/ruler" class="btn btn--primary" data-test="claim-ruler">👑 領取統治大王證書</RouterLink>
        <RouterLink v-if="nextDay" :to="`/day/${nextDay}`" class="btn btn--primary" data-test="next-day">前往 Day {{ nextDay }} ›</RouterLink>
        <RouterLink v-else to="/codex" class="btn btn--primary">前往圖鑑 ›</RouterLink>
        <button class="btn" @click="startGame">再玩一次</button>
        <RouterLink to="/map" class="btn btn--ghost">回地圖</RouterLink>
      </div>
    </section>
  </div>

  <div v-else class="missing-day">
    <TopBar title="找不到這一天" back="/map" />
    <section class="page missing-day__body">
      <CharacterSprite id="owl" :size="120" bob />
      <h2>這座島上沒有 Day {{ day }}</h2>
      <p>貓頭鷹數了三遍，只找到 Day 1 到 Day {{ TOTAL_DAYS }}。</p>
      <RouterLink to="/map" class="btn btn--primary">回雲之島地圖</RouterLink>
    </section>
  </div>
</template>

<style scoped>
.intro {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.intro__act {
  margin: 0;
  font-size: 0.8rem;
  color: var(--accent);
  font-weight: 700;
}

.intro__title {
  font-size: 1.3rem;
}

.intro__art {
  margin: 0;
  padding: 6px;
  overflow: hidden;
}

.intro__art img {
  border-radius: calc(var(--radius-lg) - 6px);
  aspect-ratio: 16 / 9;
  object-fit: cover;
  width: 100%;
}

.intro__story {
  margin: 0;
  font-size: 1rem;
}

.intro__cast {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.intro__actor {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.75rem;
  color: var(--ink-soft);
}

.chapter {
  padding: 12px 14px;
  border: 2px dashed var(--accent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent-soft) 35%, transparent);
}

.chapter__label {
  margin: 0 0 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.2em;
}

.chapter__rows {
  margin: 0;
  display: grid;
  gap: 6px;
  font-size: 0.9rem;
  line-height: 1.5;
}

.chapter__rows dt {
  display: inline;
  font-weight: 700;
}

.chapter__rows dt::after {
  content: '：';
}

.chapter__rows dd {
  display: inline;
  margin: 0;
}

/* 簡報比第一屏長時，開始按鈕貼在畫面底部；紙色外圈遮住後面的簡報文字 */
.mission__go {
  width: 100%;
  position: sticky;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 1;
  box-shadow:
    0 4px 0 var(--ink),
    0 0 0 8px var(--paper);
}

.mission__go:active {
  box-shadow:
    0 1px 0 var(--ink),
    0 0 0 8px var(--paper);
}

/* 手機與平板不另成一欄，子元素照原本順序排在開場裡 */
.intro__aside {
  display: contents;
}

.play {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.play__head {
  position: relative;
  text-align: center;
}

/* 疊在標題列右上角，不推動下方舞台；高度只占標題那一行，不壓到提示文字 */
.play__brief {
  position: absolute;
  top: 0;
  right: 0;
  min-height: 26px;
  padding: 0 10px;
  border: 2px solid var(--ink-soft);
  border-radius: 999px;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 0.8rem;
}

/* 視覺維持小巧，點擊範圍往外擴到 44px */
.play__brief::after {
  content: '';
  position: absolute;
  inset: -9px;
}

.brief-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(40 30 20 / 0.45);
}

.brief-dialog {
  width: 100%;
  max-width: 480px;
  max-height: 92dvh;
  overflow-y: auto;
}

.brief-dialog > .briefing {
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}

.brief-dialog__note {
  margin: 0 0 8px;
  font-size: 0.78rem;
  color: var(--ink-soft);
  text-align: center;
}

.brief-dialog__close {
  width: 100%;
}

.play__head h2 {
  font-size: 1.2rem;
}

.play__head p {
  margin: 2px 0 0;
  font-size: 0.88rem;
  color: var(--ink-soft);
}

.play__stage {
  min-height: 60dvh;
}

.clear {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  padding-top: 28px;
}

.clear__badge {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  border: 4px solid var(--ink);
  box-shadow:
    0 6px 0 var(--ink),
    0 0 0 10px var(--accent-soft);
  font-family: var(--font-display);
  transform: rotate(-8deg);
}

.clear__badge b {
  font-size: 3.2rem;
  line-height: 1;
}

.clear__card {
  position: relative;
  z-index: 60;
  width: 100%;
  padding: 16px;
}

.clear__label {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
  letter-spacing: 0.2em;
}

.clear__takeaway {
  margin: 6px 0 0;
  font-family: var(--font-display);
  font-size: 1.3rem;
  color: var(--ink);
}

.clear__progress,
.clear__codex-tip {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ink-soft);
}

.clear__codex-tip a {
  color: var(--accent);
  font-weight: 700;
}

.clear__actions {
  width: 100%;
  display: grid;
  gap: 10px;
}

.clear__actions .btn {
  text-decoration: none;
}

.missing-day__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 40px;
  text-align: center;
}

.missing-day__body p {
  margin: 0;
  color: var(--ink-soft);
}

/* 平板：內容 720px 置中；過關與找不到頁收成最寬 640px 的置中卡片 */
@media (min-width: 768px) {
  .intro,
  .play {
    max-width: 720px;
    margin: 0 auto;
  }

  .intro {
    gap: 18px;
  }

  .intro__title {
    font-size: clamp(1.5rem, 1rem + 1.2vw, 2.1rem);
  }

  .intro__story {
    font-size: 1.05rem;
    line-height: 1.8;
  }

  .intro__cast {
    gap: 16px;
  }

  .intro__actor > :deep(.sprite) {
    width: 64px !important;
    height: 64px !important;
  }

  .intro__actor {
    font-size: 0.82rem;
  }

  .mission__go {
    display: flex;
    width: fit-content;
    min-width: 240px;
    margin: 0 auto;
  }

  .chapter {
    padding: 14px 18px;
  }

  .chapter__rows {
    font-size: 1rem;
  }

  .brief-overlay {
    align-items: center;
    padding: 24px;
  }

  .brief-dialog {
    max-width: 560px;
  }

  .brief-dialog > .briefing {
    border-radius: var(--radius-lg);
    padding-bottom: 20px;
  }

  .play__head h2 {
    font-size: 1.5rem;
  }

  .play__head p {
    font-size: 1rem;
  }

  .clear {
    max-width: calc(640px + 48px);
    margin: 0 auto;
  }

  .missing-day__body {
    max-width: 640px;
    margin: 0 auto;
  }

  .clear {
    padding-top: 48px;
    gap: 20px;
  }

  .clear__card {
    padding: 24px 32px;
  }

  .clear__takeaway {
    font-size: 1.5rem;
  }

  .clear__actions {
    grid-template-columns: 1fr 1fr;
  }

  .clear__actions > .btn--primary {
    grid-column: 1 / -1;
  }

  .missing-day__body {
    margin-top: 48px;
    padding: 40px 32px;
    gap: 16px;
    background: var(--paper) var(--paper-texture);
    border: 2px solid var(--ink-soft);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-soft);
  }
}

/* 桌機：開場改成左圖右文，遊戲中外框放寬到 1120px 讓舞台自己決定寬度 */
@media (min-width: 1024px) {
  .intro,
  .play {
    max-width: calc(1120px + 64px);
    padding: 32px 32px 64px;
  }

  .clear {
    max-width: calc(640px + 64px);
  }

  /* 開場左欄放插圖、劇情、登場角色，右欄放章節開場與簡報；兩欄都靠上對齊 */
  .intro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    grid-template-rows: auto auto auto auto 1fr;
    grid-template-areas:
      'aside act'
      'aside title'
      'aside chapter'
      'aside mission'
      'aside .';
    column-gap: 40px;
    row-gap: 14px;
    align-items: start;
  }

  .intro__aside {
    grid-area: aside;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: sticky;
    top: 88px;
  }

  .intro__act {
    grid-area: act;
    font-size: 0.9rem;
    letter-spacing: 0.1em;
  }

  .intro__title {
    grid-area: title;
  }

  .intro__art {
    padding: 8px;
    box-shadow: var(--shadow-pop);
  }

  .intro__art img {
    aspect-ratio: 4 / 3;
  }

  .intro__cast {
    justify-content: flex-start;
    gap: 8px 10px;
  }

  .intro__actor > :deep(.sprite) {
    width: 56px !important;
    height: 56px !important;
  }

  .chapter {
    grid-area: chapter;
  }

  .mission {
    grid-area: mission;
    margin-top: 6px;
  }

  .mission__go {
    width: 100%;
  }

  /* 遊戲中：標題與玩法說明移到舞台左側，省下垂直空間給舞台與控制列 */
  .play {
    padding-bottom: 24px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 504px) minmax(0, 1fr);
    column-gap: 32px;
    align-items: start;
  }

  .play__head {
    grid-column: 1;
    justify-self: end;
    max-width: 260px;
    padding-top: 40px;
    text-align: right;
    text-wrap: pretty;
  }

  .play__stage {
    grid-column: 2;
    min-height: 0;
  }

  /* 桌機標題列在舞台左側獨立一欄，按鈕回到文字流 */
  .play__brief {
    position: static;
    margin-top: 12px;
    min-height: 44px;
    padding: 0 16px;
    font-size: 0.95rem;
  }

  .play__brief::after {
    content: none;
  }
}
</style>
