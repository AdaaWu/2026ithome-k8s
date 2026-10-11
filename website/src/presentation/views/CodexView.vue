<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGame } from '@/application/useGame'
import { CHARACTERS } from '@/data/characters'
import type { Character, CharacterCategory } from '@/domain/character'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import ConfettiBurst from '@/presentation/components/ui/ConfettiBurst.vue'
import TopBar from '@/presentation/components/ui/TopBar.vue'

const game = useGame()

const CATEGORY_NAMES: Record<CharacterCategory, string> = {
  world: '島嶼本體',
  'control-plane': '燈塔村',
  workload: '泡泡管理者',
  network: '道路與入口',
  'config-storage': '設定與倉庫',
  ops: '讓島自己運轉',
}

const groups = computed(() =>
  (Object.keys(CATEGORY_NAMES) as CharacterCategory[])
    .map((key) => ({ key, name: CATEGORY_NAMES[key], members: CHARACTERS.filter((c) => c.category === key) }))
    .filter((g) => g.members.length > 0),
)

const active = ref<Character | null>(null)
const wrongPicks = ref<string[]>([])
const justUnlocked = ref(false)
const shaking = ref(false)

function open(c: Character) {
  playSfx('tap')
  active.value = c
  wrongPicks.value = []
  justUnlocked.value = false
  game.seeCharacter(c.id)
}

function close() {
  active.value = null
}

function pick(option: string) {
  if (!active.value || wrongPicks.value.includes(option)) return
  if (game.answerCharacter(active.value.id, option)) {
    playSfx('unlock')
    justUnlocked.value = true
  } else {
    playSfx('wrong')
    wrongPicks.value.push(option)
    shaking.value = true
    setTimeout(() => (shaking.value = false), 400)
  }
}

const activeUnlocked = computed(() => (active.value ? game.isUnlocked(active.value.id) : false))
</script>

<template>
  <div class="codex">
    <TopBar title="Day 31・角色圖鑑" back="/map" />

    <section class="page">
      <div class="codex__head paper">
        <p>
          收集進度 <b data-test="codex-count">{{ game.unlockedCount.value }}</b> / {{ game.totalCharacters }}
        </p>
        <small>點一下影子，讀謎題、猜猜看他是誰。答對就會恢復色彩！</small>
      </div>

      <section v-for="g in groups" :key="g.key" class="group">
        <h2 class="group__name">{{ g.name }}</h2>
        <div class="grid">
          <button
            v-for="c in g.members"
            :key="c.id"
            class="cell"
            :class="{ 'is-unlocked': game.isUnlocked(c.id) }"
            :data-test="`codex-${c.id}`"
            @click="open(c)"
          >
            <CharacterSprite :id="c.id" :size="64" :silhouette="!game.isUnlocked(c.id)" />
            <span class="cell__name">{{ game.isUnlocked(c.id) ? c.name : '？？？' }}</span>
            <span v-if="!game.isUnlocked(c.id) && game.isSeen(c.id)" class="cell__seen">挑戰中</span>
          </button>
        </div>
      </section>
    </section>

    <Transition name="sheet">
      <div v-if="active" class="overlay" @click.self="close">
        <ConfettiBurst v-if="justUnlocked" />
        <article class="sheet paper" role="dialog" aria-modal="true" :class="{ shake: shaking }">
          <button class="sheet__close" aria-label="關閉" @click="close">×</button>

          <div class="sheet__portrait" :class="{ 'is-reveal': justUnlocked }">
            <CharacterSprite :id="active.id" :size="140" :silhouette="!activeUnlocked" bob />
          </div>

          <template v-if="!activeUnlocked">
            <p class="sheet__label">影子謎題</p>
            <p class="sheet__riddle">{{ active.riddle }}</p>
            <div class="options">
              <button
                v-for="opt in active.options"
                :key="opt"
                class="option"
                :class="{ 'is-wrong': wrongPicks.includes(opt) }"
                :disabled="wrongPicks.includes(opt)"
                :data-test="`option-${opt}`"
                @click="pick(opt)"
              >
                {{ opt }}
              </button>
            </div>
            <p v-if="wrongPicks.length" class="sheet__retry">不是他喔，再想想看～</p>
          </template>

          <template v-else>
            <p v-if="justUnlocked" class="sheet__yay pop-in">答對了！角色恢復色彩 ✨</p>
            <h3 class="sheet__name">{{ active.name }}</h3>
            <p class="sheet__k8s">
              {{ active.k8sName }}<template v-if="active.zhTerm">（{{ active.zhTerm }}）</template>
            </p>
            <p class="sheet__desc">{{ active.description }}</p>
            <RouterLink :to="`/day/${active.debutDay}`" class="sheet__debut">
              <img :src="`art/day-${String(active.debutDay).padStart(2, '0')}-01.webp`" alt="" loading="lazy" />
              <span>首次登場：Day {{ active.debutDay }} ›</span>
            </RouterLink>
          </template>
        </article>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.codex__head {
  padding: 12px 14px;
  text-align: center;
}

.codex__head p {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
}

.codex__head b {
  color: var(--accent);
  font-size: 1.4rem;
}

.codex__head small {
  color: var(--ink-soft);
}

.group {
  margin-top: 20px;
}

.group__name {
  font-size: 1rem;
  margin-bottom: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px 8px;
  border: 2px solid var(--ink-soft);
  border-radius: var(--radius-md);
  background: var(--cloud);
  transition: transform 0.1s;
}

.cell:active {
  transform: scale(0.95);
}

.cell.is-unlocked {
  background: var(--paper);
  border-color: var(--leaf-deep);
}

.cell__name {
  font-family: var(--font-display);
  font-size: 0.82rem;
  line-height: 1.2;
}

.cell__seen {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 0.62rem;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(40 30 20 / 0.45);
}

.sheet {
  position: relative;
  width: 100%;
  max-width: 480px;
  max-height: 92dvh;
  overflow-y: auto;
  padding: 20px 18px calc(24px + env(safe-area-inset-bottom));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  text-align: center;
}

.sheet__close {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 40px;
  height: 40px;
  border: none;
  background: none;
  font-size: 1.8rem;
}

.sheet__portrait {
  display: grid;
  place-items: center;
  margin: 4px auto 8px;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, var(--cloud) 70%);
}

.sheet__portrait.is-reveal {
  animation: reveal 0.9s ease-out;
}

@keyframes reveal {
  0% {
    box-shadow: 0 0 0 0 rgb(246 201 69 / 0.9);
    transform: scale(0.9);
  }
  60% {
    box-shadow: 0 0 0 30px rgb(246 201 69 / 0);
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

.sheet__label {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  color: var(--ink-soft);
}

.sheet__riddle {
  margin: 6px 0 14px;
  font-family: var(--font-display);
  font-size: 1.1rem;
}

.options {
  display: grid;
  gap: 10px;
}

.option {
  min-height: 50px;
  padding: 8px 12px;
  border: 2px solid var(--ink);
  border-radius: var(--radius-md);
  background: #fff;
  font-size: 1rem;
  box-shadow: 0 3px 0 var(--ink);
}

.option:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--ink);
}

.option.is-wrong {
  opacity: 0.35;
  text-decoration: line-through;
  box-shadow: none;
}

.sheet__retry {
  margin: 10px 0 0;
  color: var(--danger);
}

.sheet__yay {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-display);
}

.sheet__name {
  font-size: 1.6rem;
}

.sheet__k8s {
  margin: 2px 0 10px;
  font-weight: 700;
  color: var(--accent);
}

.sheet__desc {
  margin: 0 0 14px;
  text-align: left;
}

.sheet__debut {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border: 2px solid var(--ink-soft);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--ink);
  background: #fff;
}

.sheet__debut img {
  width: 96px;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 8px;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}

/* 平板：內容 720px 置中，網格 6 欄讓 6 人分組剛好一排；影子題改成置中對話框 */
@media (min-width: 768px) {
  .codex > .page {
    max-width: 720px;
    margin: 0 auto;
    padding-top: 24px;
  }

  .codex__head {
    padding: 16px 24px;
  }

  .group {
    margin-top: 28px;
  }

  .group__name {
    font-size: 1.1rem;
    margin-bottom: 12px;
  }

  .grid {
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
  }

  .cell {
    padding: 14px 6px 10px;
  }

  .cell > :deep(.sprite) {
    width: 72px !important;
    height: 72px !important;
  }

  .cell__name {
    font-size: 0.9rem;
  }

  .overlay {
    align-items: center;
    padding: 24px;
  }

  .sheet {
    max-width: 520px;
    max-height: 86dvh;
    padding: 28px 32px 28px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-pop);
  }

  .sheet__portrait {
    width: 200px;
    height: 200px;
  }

  .sheet__portrait > :deep(.sprite) {
    width: 160px !important;
    height: 160px !important;
  }

  .sheet__portrait.is-reveal {
    animation: reveal-wide 1.1s ease-out;
  }

  .options {
    grid-template-columns: 1fr 1fr;
  }

  .sheet__debut img {
    width: 128px;
  }

  .sheet-enter-from .sheet,
  .sheet-leave-to .sheet {
    transform: translateY(24px) scale(0.92);
  }
}

/* 桌機：內容 1120px 置中，網格 8 欄，最大分組剛好一排 */
@media (min-width: 1024px) {
  .codex > .page {
    max-width: 1120px;
    padding: 32px 32px 64px;
  }

  .codex__head {
    max-width: 640px;
    margin: 0 auto;
  }

  .group {
    margin-top: 36px;
  }

  .grid {
    grid-template-columns: repeat(8, 1fr);
    gap: 16px;
  }
}

@media (min-width: 1024px) and (hover: hover) {
  .cell {
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .cell:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-pop);
  }

  .cell:active {
    transform: scale(0.95);
  }
}

/* 對話框比手機面板寬，揭曉光圈放大，再補一圈柔和的金色餘暉 */
@media (min-width: 768px) {
  @keyframes reveal-wide {
    0% {
      box-shadow:
        0 0 0 0 rgb(246 201 69 / 0.9),
        0 0 0 0 rgb(240 138 36 / 0.5);
      transform: scale(0.85);
    }
    55% {
      box-shadow:
        0 0 0 44px rgb(246 201 69 / 0),
        0 0 0 18px rgb(240 138 36 / 0.25);
      transform: scale(1.1);
    }
    100% {
      box-shadow:
        0 0 0 44px rgb(246 201 69 / 0),
        0 0 0 30px rgb(240 138 36 / 0);
      transform: scale(1);
    }
  }
}

/* 桌機補足點擊目標尺寸 */
@media (min-width: 768px) {
  .sheet__close {
    width: 44px;
    height: 44px;
  }
}
</style>
