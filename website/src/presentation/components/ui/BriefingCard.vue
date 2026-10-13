<script setup lang="ts">
import type { DayLevel } from '@/domain/level'

defineProps<{ level: DayLevel }>()
</script>

<template>
  <article class="briefing paper" data-test="briefing">
    <p class="briefing__label">任務簡報</p>
    <h3 class="briefing__name">{{ level.gameTitle }}</h3>
    <dl class="briefing__rows">
      <div class="briefing__row">
        <dt>情境痛點</dt>
        <dd>{{ level.briefing.pain }}</dd>
      </div>
      <div class="briefing__row">
        <dt>K8s 對應概念</dt>
        <dd><b>{{ level.concept }}</b>：{{ level.briefing.conceptPlain }}</dd>
      </div>
      <div class="briefing__row">
        <dt>你的任務</dt>
        <dd>{{ level.briefing.goal }}</dd>
      </div>
      <div class="briefing__row">
        <dt>怎麼玩</dt>
        <dd>
          <ol class="briefing__steps">
            <li v-for="(step, i) in level.briefing.steps" :key="i">{{ step }}</li>
          </ol>
        </dd>
      </div>
      <div class="briefing__row briefing__row--win">
        <dt>過關條件</dt>
        <dd>{{ level.briefing.winCondition }}</dd>
      </div>
      <div class="briefing__row">
        <dt>玩完你會體會到</dt>
        <dd>{{ level.briefing.insight }}</dd>
      </div>
    </dl>
    <slot />
  </article>
</template>

<style scoped>
.briefing {
  padding: 16px;
  text-align: left;
}

.briefing__label {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
  letter-spacing: 0.2em;
  text-align: center;
}

.briefing__name {
  margin: 4px 0 10px;
  font-size: 1.35rem;
  text-align: center;
}

.briefing__rows {
  margin: 0 0 14px;
  display: grid;
  gap: 8px;
}

.briefing__row dt {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent);
}

.briefing__row dd {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
}

.briefing__row--win dd {
  font-weight: 700;
}

.briefing__steps {
  margin: 0;
  padding-left: 1.3em;
}

@media (min-width: 768px) {
  .briefing {
    padding: 20px 24px;
  }

  .briefing__row dd {
    font-size: 1rem;
  }
}
</style>
