<script setup lang="ts">
import { computed, ref } from 'vue'
import { CHARACTERS } from '@/data/characters'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'

// 尚未設計專屬小遊戲的 Day：點遍今日角色、認識他們就過關
const props = defineProps<{ characterIds: string[] }>()
const emit = defineEmits<{ complete: [] }>()

const met = ref<string[]>([])
const cast = computed(() => CHARACTERS.filter((c) => props.characterIds.includes(c.id)))
const focus = ref<string | null>(null)
const focused = computed(() => cast.value.find((c) => c.id === focus.value))

function meet(id: string) {
  focus.value = id
  if (met.value.includes(id)) return
  met.value.push(id)
  playSfx('pop')
  if (met.value.length === cast.value.length) {
    setTimeout(() => emit('complete'), 900)
  }
}
</script>

<template>
  <div class="fallback">
    <p class="fallback__hint">點一下每位角色，跟他們打招呼（{{ met.length }}/{{ cast.length }}）</p>
    <div class="fallback__cast">
      <button v-for="c in cast" :key="c.id" class="fallback__actor" :class="{ 'is-met': met.includes(c.id) }" @click="meet(c.id)">
        <CharacterSprite :id="c.id" :size="76" :bob="!met.includes(c.id)" />
        <span>{{ met.includes(c.id) ? c.name : '？？？' }}</span>
      </button>
    </div>
    <p v-if="focused" class="fallback__bubble paper pop-in" :key="focused.id">
      <strong>{{ focused.name }}（{{ focused.k8sName }}）</strong>
      {{ focused.description }}
    </p>
  </div>
</template>

<style scoped>
.fallback__hint {
  text-align: center;
  margin: 0 0 12px;
}

.fallback__cast {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.fallback__actor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 96px;
  padding: 8px 4px;
  border: 2px dashed var(--ink-soft);
  border-radius: var(--radius-md);
  background: var(--paper);
  font-size: 0.85rem;
}

.fallback__actor.is-met {
  border-style: solid;
  border-color: var(--leaf-deep);
}

.fallback__bubble {
  margin: 16px 0 0;
  padding: 12px 14px;
  font-size: 0.92rem;
}

.fallback__bubble strong {
  display: block;
  font-family: var(--font-display);
}
</style>
