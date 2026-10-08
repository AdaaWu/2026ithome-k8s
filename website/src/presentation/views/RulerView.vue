<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGame } from '@/application/useGame'
import { CHARACTERS } from '@/data/characters'
import { LEVELS } from '@/data/levels'
import { RULER_TITLE } from '@/domain/achievement'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import ConfettiBurst from '@/presentation/components/ui/ConfettiBurst.vue'
import TopBar from '@/presentation/components/ui/TopBar.vue'

const game = useGame()

const missingDays = computed(() => LEVELS.filter((l) => !game.isDayCleared(l.day)).map((l) => l.day))
const missingCharacters = computed(() => CHARACTERS.filter((c) => !game.isUnlocked(c.id)))
const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })

/** 證書下緣的角色遊行 */
const parade = CHARACTERS.slice(0, 12)

onMounted(() => {
  if (game.isRuler.value) playSfx('win')
})
</script>

<template>
  <div class="ruler">
    <TopBar title="統治大王證書" back="/map" />

    <section v-if="game.isRuler.value" class="page">
      <ConfettiBurst />
      <article class="cert paper pop-in" data-test="certificate">
        <div class="cert__crown">👑</div>
        <p class="cert__lead">茲證明</p>
        <h2 class="cert__name">{{ game.progress.value.nickname }}</h2>
        <p class="cert__body">
          走遍雲之島 30 天、喚醒全部 {{ game.totalCharacters }} 位居民，<br />
          從此島上的泡泡、圖騰柱與貓頭鷹都聽你的哨子
        </p>
        <p class="cert__title">{{ RULER_TITLE }}</p>
        <p class="cert__date">{{ today }}・燈塔櫃台 核發</p>
        <div class="cert__parade">
          <CharacterSprite v-for="(c, i) in parade" :key="c.id" :id="c.id" :size="36" bob :style="{ animationDelay: `${i * 0.15}s` }" />
        </div>
      </article>
      <p class="ruler__tip">截圖分享給同事，炫耀你的 K8s 島主身分吧！</p>
      <RouterLink to="/map" class="btn btn--primary ruler__back">回到島上</RouterLink>
    </section>

    <section v-else class="page">
      <article class="cert cert--locked paper">
        <div class="cert__crown">🔒</div>
        <h2 class="cert__name">尚未登基</h2>
        <p class="cert__body">要成為「{{ RULER_TITLE }}」，還差：</p>
        <p v-if="missingDays.length">
          關卡：
          <RouterLink v-for="d in missingDays" :key="d" :to="`/day/${d}`" class="missing">Day {{ d }}</RouterLink>
        </p>
        <p v-if="missingCharacters.length">
          圖鑑：還有 <RouterLink to="/codex" class="missing">{{ missingCharacters.length }} 位角色</RouterLink> 是影子
        </p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.cert {
  position: relative;
  padding: 28px 18px 18px;
  text-align: center;
  border: 4px double var(--bark);
  background:
    radial-gradient(circle at 50% 0%, rgb(246 201 69 / 0.35), transparent 60%),
    var(--paper) var(--paper-texture);
}

.cert__crown {
  font-size: 3.4rem;
  line-height: 1;
  animation: bob 2.4s ease-in-out infinite;
}

.cert__lead {
  margin: 8px 0 0;
  letter-spacing: 0.4em;
  color: var(--ink-soft);
}

.cert__name {
  margin: 4px 0 10px;
  font-size: 2.2rem;
  color: var(--accent);
  word-break: break-all;
}

.cert__body {
  margin: 0 0 12px;
  font-size: 0.95rem;
}

.cert__title {
  display: inline-block;
  margin: 0;
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--gold);
  border: 3px solid var(--ink);
  font-family: var(--font-display);
  font-size: 1.25rem;
  box-shadow: 0 4px 0 var(--ink);
}

.cert__date {
  margin: 14px 0 6px;
  font-size: 0.8rem;
  color: var(--ink-soft);
}

.cert__parade {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
}

.ruler__tip {
  text-align: center;
  color: var(--ink-soft);
}

.ruler__back {
  width: 100%;
  text-decoration: none;
}

.cert--locked .cert__name {
  color: var(--ink-soft);
}

.missing {
  display: inline-block;
  margin: 2px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1.5px solid var(--accent);
  color: var(--ink);
  text-decoration: none;
  font-size: 0.85rem;
}
</style>
