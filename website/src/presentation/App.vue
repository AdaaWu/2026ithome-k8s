<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGame } from '@/application/useGame'

const router = useRouter()
const { isRuler } = useGame()

// 第一次達成統治大王時，直接帶去領證書
watch(isRuler, (now, before) => {
  if (now && !before) void router.push({ name: 'ruler' })
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
}
</style>
