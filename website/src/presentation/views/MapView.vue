<script setup lang="ts">
import { computed } from 'vue'
import { useGame } from '@/application/useGame'
import { LEVELS } from '@/data/levels'
import { ACTS, CODEX_DAY } from '@/domain/level'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import TopBar from '@/presentation/components/ui/TopBar.vue'

const game = useGame()

const acts = computed(() =>
  ACTS.map((act) => ({
    ...act,
    levels: LEVELS.filter((l) => l.day >= act.days[0] && l.day <= act.days[1]),
  })),
)

/** 下一個建議挑戰的 Day：第一個還沒過的 */
const nextDay = computed(() => LEVELS.find((l) => !game.isDayCleared(l.day))?.day)

const dayPercent = computed(() => Math.round((game.clearedCount.value / game.totalDays) * 100))
const codexPercent = computed(() => Math.round((game.unlockedCount.value / game.totalCharacters) * 100))

/** 關卡節點左右蛇行排列 */
const OFFSETS = ['0%', '22%', '44%', '22%']
const offsetOf = (day: number) => OFFSETS[(day - 1) % OFFSETS.length]

/** 標題只取逗號或問號前的主標，節點才放得下 */
const shortTitle = (title: string) => title.split(/[，？?,]/)[0].trim()
</script>

<template>
  <div class="map">
    <TopBar title="雲之島地圖" back="/" />

    <!-- 桌機左右兩欄用的容器，手機版沒有樣式 -->
    <div class="map__body">
      <aside class="map__side">
        <section class="hud paper">
          <div class="hud__who">
            <CharacterSprite id="bird" :size="52" bob />
            <div>
              <p class="hud__name">{{ game.progress.value.nickname }}</p>
              <span class="chip" :class="{ 'chip--gold': game.isRuler.value }" data-test="title">{{ game.title.value }}</span>
            </div>
          </div>
          <div class="hud__bars">
            <label>
              關卡 {{ game.clearedCount.value }}/{{ game.totalDays }}
              <span class="bar"><i :style="{ width: `${dayPercent}%` }" /></span>
            </label>
            <label>
              圖鑑 {{ game.unlockedCount.value }}/{{ game.totalCharacters }}
              <span class="bar bar--codex"><i :style="{ width: `${codexPercent}%` }" /></span>
            </label>
          </div>
          <RouterLink v-if="game.isRuler.value" to="/ruler" class="btn btn--primary hud__ruler">👑 查看統治大王證書</RouterLink>
          <p v-else class="hud__goal">目標：破完 30 關，並在圖鑑答對全部角色，成為「K8s 雲之島統治大王」</p>
        </section>

        <RouterLink to="/prologue" class="codex-shortcut prologue-shortcut paper" data-test="prologue-link">
          <span class="codex-shortcut__icons">
            <CharacterSprite id="island" :size="40" />
          </span>
          <span>
            <strong>序章：雲之島是什麼？</strong>
            <small>世界規則與核心角色，忘了隨時回來看</small>
          </span>
          <span class="codex-shortcut__arrow">›</span>
        </RouterLink>

        <RouterLink to="/codex" class="codex-shortcut paper" data-test="codex-link">
          <span class="codex-shortcut__icons">
            <CharacterSprite id="owl" :size="40" silhouette />
            <CharacterSprite id="totem" :size="40" silhouette />
            <CharacterSprite id="squirrel" :size="40" silhouette />
          </span>
          <span>
            <strong>Day {{ CODEX_DAY }}・角色圖鑑</strong>
            <small>猜出影子是誰，讓角色恢復色彩</small>
          </span>
          <span class="codex-shortcut__arrow">›</span>
        </RouterLink>
      </aside>

      <div class="map__main">
        <div class="map__acts">
          <section v-for="act in acts" :key="act.id" class="act">
            <h2 class="act__name">{{ act.name }}</h2>
            <p class="act__goal">本章目標：{{ act.goal }}</p>
            <ol class="path">
              <li v-for="level in act.levels" :key="level.day" class="node" :style="{ '--offset': offsetOf(level.day) }">
                <RouterLink
                  :to="`/day/${level.day}`"
                  class="node__link"
                  :class="{ 'is-cleared': game.isDayCleared(level.day), 'is-next': level.day === nextDay }"
                  :data-test="`day-${level.day}`"
                >
                  <span class="node__disc">
                    <img :src="level.image" alt="" loading="lazy" />
                    <b>{{ level.day }}</b>
                    <span v-if="game.isDayCleared(level.day)" class="node__stamp">✓</span>
                  </span>
                  <span class="node__label">
                    <small>{{ level.concept }}</small>
                    {{ shortTitle(level.title) }}
                  </span>
                </RouterLink>
              </li>
            </ol>
          </section>
        </div>

        <RouterLink to="/codex" class="finale paper">
          <CharacterSprite id="island" :size="72" bob />
          <span>
            <strong>Day {{ CODEX_DAY }}：角色圖鑑</strong>
            <small>{{ game.unlockedCount.value }} / {{ game.totalCharacters }} 位角色已現身</small>
          </span>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map {
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}

.hud {
  margin: 8px 16px 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hud__who {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hud__name {
  margin: 0 0 2px;
  font-family: var(--font-display);
  font-size: 1.2rem;
}

.chip--gold {
  background: var(--gold);
  border-color: var(--ink);
  font-weight: 700;
}

.hud__bars {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
}

.bar {
  display: block;
  height: 10px;
  margin-top: 2px;
  border-radius: 999px;
  background: var(--cloud);
  border: 1.5px solid var(--ink-soft);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--leaf);
  transition: width 0.6s;
}

.bar--codex i {
  background: var(--accent);
}

.hud__goal {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
}

.hud__ruler {
  text-decoration: none;
}

.codex-shortcut,
.finale {
  margin: 0 16px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--ink);
}

.codex-shortcut strong,
.finale strong {
  display: block;
  font-family: var(--font-display);
}

.codex-shortcut small,
.finale small {
  color: var(--ink-soft);
}

.codex-shortcut__icons {
  display: flex;
  margin-right: -6px;
}

.codex-shortcut__icons > * + * {
  margin-left: -14px;
}

.codex-shortcut__arrow {
  margin-left: auto;
  font-size: 1.6rem;
}

/* 序章入口沿用圖鑑入口卡樣式，與下方圖鑑卡留間距 */
.codex-shortcut.prologue-shortcut {
  margin-bottom: 12px;
}

.act {
  margin-top: 26px;
}

.act__name {
  margin: 0 16px 6px;
  padding: 6px 14px;
  display: inline-block;
  font-size: 1rem;
  background: var(--paper);
  border: 2px solid var(--ink-soft);
  border-radius: 999px;
}

.act__goal {
  margin: 0 16px 6px;
  font-size: 0.82rem;
  color: var(--ink-soft);
}

.path {
  list-style: none;
  margin: 0;
  padding: 0 16px;
  position: relative;
}

.node {
  position: relative;
  padding-left: var(--offset);
  margin: 2px 0;
}

/* 節點之間的虛線小路 */
.node + .node::before {
  content: '';
  position: absolute;
  top: -14px;
  left: calc(var(--offset) + 34px);
  height: 22px;
  border-left: 4px dotted var(--bark);
  opacity: 0.5;
}

.node__link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  text-decoration: none;
  color: var(--ink);
  border-radius: var(--radius-md);
}

.node__disc {
  position: relative;
  flex: none;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 3px solid var(--ink);
  background: var(--paper);
  overflow: hidden;
  box-shadow: 0 4px 0 var(--ink);
  transition: transform 0.1s;
}

.node__link:active .node__disc {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--ink);
}

.node__disc img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.45) brightness(1.05);
}

.node__disc b {
  position: absolute;
  left: 50%;
  bottom: -2px;
  transform: translateX(-50%);
  min-width: 30px;
  padding: 0 6px;
  border-radius: 999px 999px 0 0;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--font-display);
  font-size: 0.95rem;
  text-align: center;
  line-height: 1.5;
}

.is-cleared .node__disc {
  border-color: var(--leaf-deep);
}

.is-cleared .node__disc img {
  filter: none;
  opacity: 1;
}

.node__stamp {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--leaf-deep);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 900;
  border: 2px solid #fff;
}

.is-next .node__disc {
  border-color: var(--accent);
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow:
      0 4px 0 var(--ink),
      0 0 0 0 rgb(240 138 36 / 0.6);
  }
  50% {
    box-shadow:
      0 4px 0 var(--ink),
      0 0 0 10px rgb(240 138 36 / 0);
  }
}

.node__label {
  font-family: var(--font-display);
  font-size: 0.95rem;
  line-height: 1.3;
  min-width: 0;
}

.node__label small {
  display: block;
  font-family: var(--font-body);
  font-size: 0.72rem;
  color: var(--accent);
  font-weight: 700;
}

.finale {
  margin-top: 28px;
  background: linear-gradient(135deg, var(--paper), var(--accent-soft));
}

/* 平板：單欄置中，最寬 720px */
@media (min-width: 768px) {
  .map__body {
    max-width: calc(720px + 48px);
    margin: 0 auto;
    padding: 0 24px;
  }

  .hud {
    margin: 24px 0 12px;
  }

  .codex-shortcut {
    margin: 0;
  }

  .act__name,
  .act__goal {
    margin-left: 0;
    margin-right: 0;
  }

  .path {
    padding: 0;
  }

  .finale {
    margin: 28px 0 0;
  }
}

/* 桌機：左側固定玩家資訊欄，右側幕卡片兩兩一列（Z 字順序），同列等高 */
@media (min-width: 1024px) {
  .map__body {
    max-width: calc(1120px + 64px);
    padding: 32px 32px 0;
    display: grid;
    grid-template-columns: 288px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }

  .map__side {
    position: sticky;
    top: 96px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hud,
  .codex-shortcut {
    margin: 0;
  }

  .hud {
    padding: 20px;
    gap: 14px;
  }

  .hud__name {
    font-size: 1.35rem;
  }

  .hud__bars {
    gap: 10px;
    font-size: 0.95rem;
  }

  .bar {
    height: 12px;
  }

  .hud__goal {
    font-size: 0.88rem;
    line-height: 1.7;
  }

  .codex-shortcut {
    padding: 14px 16px;
  }

  .codex-shortcut.prologue-shortcut {
    margin-bottom: 0;
  }

  /* 第五幕跨兩列，第六幕與終點卡疊在它右邊，三列高度一致 */
  .map__main {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
  }

  .map__acts {
    display: contents;
  }

  .act {
    margin: 0;
    padding: 18px 16px 14px;
    background: color-mix(in srgb, var(--paper) 55%, transparent);
    border: 2px dashed color-mix(in srgb, var(--ink-soft) 45%, transparent);
    border-radius: var(--radius-lg);
  }

  .act:nth-child(5) {
    grid-row: 3 / span 2;
  }

  .act__name {
    margin: 0 0 10px;
    font-size: 1.1rem;
  }

  .act__goal {
    margin: -4px 0 10px;
    font-size: 0.9rem;
    text-wrap: pretty;
  }

  .path {
    padding: 0;
  }

  /* 卡片較窄，蛇行幅度收小，長標題才不會折太多行 */
  .node {
    padding-left: calc(var(--offset) * 0.35);
    margin: 6px 0;
  }

  .node + .node::before {
    top: -16px;
    left: calc(var(--offset) * 0.35 + 44px);
    height: 26px;
  }

  .node__disc {
    width: 80px;
    height: 80px;
  }

  .node__label {
    font-size: 1.02rem;
    text-wrap: pretty;
  }

  .node__label small {
    font-size: 0.78rem;
  }

  .finale {
    grid-column: 2;
    grid-row: 4;
    align-self: end;
    margin: 0;
    padding: 16px 20px;
  }
}

@media (min-width: 1024px) and (hover: hover) {
  .node__link {
    transition: background-color 0.15s;
  }

  .node__link:hover {
    background: color-mix(in srgb, var(--cloud) 70%, transparent);
  }

  .node__link:hover .node__disc {
    transform: translateY(-2px);
  }

  .codex-shortcut,
  .finale {
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .codex-shortcut:hover,
  .finale:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-pop);
  }
}
</style>
