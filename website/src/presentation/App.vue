<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGame } from '@/application/useGame'

const REVEAL_DELAY_MS = 2600

const route = useRoute()
const router = useRouter()
const { isRuler } = useGame()

// 在圖鑑達成時，先讓玩家看完角色變彩色再帶去證書；在關卡達成時由過關頁的按鈕前往
watch(isRuler, (now, before) => {
  if (!now || before || route.name !== 'codex') return
  setTimeout(() => {
    if (route.name === 'codex') void router.push({ name: 'ruler' })
  }, REVEAL_DELAY_MS)
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
